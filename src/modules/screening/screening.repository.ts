/**
 * ScreeningRepository — all MongoDB reads and writes for the screening feature.
 *
 * Follows the same repository pattern used across the codebase.
 * No business logic here — just data access.
 */

import { getDb } from "@/config/database.js";
import { ObjectId } from "mongodb";
import type { JobJSON } from "@/modules/job/job.types.js";
import type {
    ApplicationWithApplicant,
    ApplicationUpdate,
    ShortlistEntry,
} from "./screening.types.js";
import logger from "@/shared/utils/logger.js";

export class ScreeningRepository {

    // ─── Reads ────────────────────────────────────────────────────────────────

    /**
     * Fetch a job by ID.
     * Returns null if the ID is invalid or the job does not exist.
     */
    async findJob(jobId: string): Promise<JobJSON | null> {
        if (!ObjectId.isValid(jobId)) return null;
        const db = await getDb();
        const job = await db.collection("jobs").findOne({ _id: new ObjectId(jobId) });
        if (!job) return null;
        return { ...job, _id: job._id.toString(), recruiterId: job.recruiterId.toString() } as unknown as JobJSON;
    }

    /**
     * Fetch all applications eligible for screening (status: pending, reviewed, shortlisted, or rejected)
     * for a given job, joined with the applicant's profile.
     *
     * Uses a $lookup aggregation so we get the full applicant profile in one query
     * rather than N+1 queries.
     */
    async findEligibleApplications(jobId: string): Promise<ApplicationWithApplicant[]> {
        if (!ObjectId.isValid(jobId)) return [];
        const db = await getDb();

        const results = await db.collection("applications").aggregate([
            // Match applications eligible for screening.
            // We include 'shortlisted' and 'rejected' to allow re-screening (e.g. after updating job requirements).
            { 
                $match: { 
                    jobId: new ObjectId(jobId), 
                    status: { $in: ["pending", "reviewed", "shortlisted", "rejected"] } 
                } 
            },

            // Join with applicants collection on applicantId → userId
            // Robust Join: Matches regardless of whether userId is stored as String or ObjectId
            {
                $lookup: {
                    from: "applicants",
                    localField: "applicantId",
                    foreignField: "userId",
                    as: "applicant"
                }
            },
            { $unwind: { path: "$applicant", preserveNullAndEmptyArrays: false } },

            // Project only the fields we need for screening
            // Note: profile fields are stored under '$applicant.profile'
            {
                $project: {
                    application_id: { $toString: "$_id" },
                    applicant_id:   { $toString: "$applicantId" },
                    appliedAt:      1,
                    cvRawText:      1,
                    status:         1,
                    profile: {
                        first_name:     "$applicant.profile.first_name",
                        last_name:      "$applicant.profile.last_name",
                        headline:       "$applicant.profile.headline",
                        bio:            "$applicant.profile.bio",
                        skills:         "$applicant.profile.skills",
                        experience:     "$applicant.profile.experience",
                        education:      "$applicant.profile.education",
                        projects:       "$applicant.profile.projects",
                        certifications: "$applicant.profile.certifications",
                        languages:      "$applicant.profile.languages"
                    }
                }
            }
        ]).toArray();

        logger.info(`ScreeningRepository.findEligibleApplications: jobId=${jobId}, found=${results.length}`);
        return results as unknown as ApplicationWithApplicant[];
    }

    /**
     * Fetch the ranked shortlist for a job — applications that have already been
     * screened, sorted by final_score descending, limited to N results.
     *
     * Includes first_name, last_name, headline from the applicant profile
     * so the recruiter can identify candidates without a separate lookup.
     */
    async findShortlist(jobId: string, limit: number): Promise<ShortlistEntry[]> {
        if (!ObjectId.isValid(jobId)) return [];
        const db = await getDb();

        const results = await db.collection("applications").aggregate([
            // Only applications that have been screened and shortlisted
            {
                $match: {
                    jobId: new ObjectId(jobId),
                    screening_result: { $exists: true },
                    status: "shortlisted"
                }
            },

            // Sort by final score descending (best candidates first)
            { $sort: { "screening_result.final_score": -1, appliedAt: 1 } },

            // Limit to top N
            { $limit: limit },

            // Join with applicants to get name and headline
            {
                $lookup: {
                    from: "applicants",
                    localField: "applicantId",
                    foreignField: "userId",
                    as: "applicant"
                }
            },
            { $unwind: { path: "$applicant", preserveNullAndEmptyArrays: true } },

            // Shape the output
            // Note: identity fields are nested under '$applicant.profile'
            {
                $project: {
                    application_id:   { $toString: "$_id" },
                    applicant_id:     { $toString: "$applicantId" },
                    first_name:       "$applicant.profile.first_name",
                    last_name:        "$applicant.profile.last_name",
                    headline:         "$applicant.profile.headline",
                    profile:          "$applicant.profile",
                    screening_result: 1
                }
            }
        ]).toArray();

        return results as unknown as ShortlistEntry[];
    }

    // ─── Writes ───────────────────────────────────────────────────────────────

    /**
     * Persist screening results for all candidates in a single bulkWrite call.
     *
     * Uses ordered:false so a failure on one document does not abort the rest.
     * Any per-document write errors are logged individually after the batch completes.
     *
     * Each application gets:
     *   - screening_result: the full ScreeningResult object
     *   - status: "shortlisted" or "rejected"
     *   - updatedAt: current UTC timestamp
     */
    async saveScreeningResults(results: ApplicationUpdate[]): Promise<void> {
        if (results.length === 0) return;
        const db = await getDb();

        const operations = results.map(update => ({
            updateOne: {
                filter: { _id: new ObjectId(update.application_id) },
                update: {
                    $set: {
                        screening_result: update.screening_result,
                        status:           update.new_status,
                        updatedAt:        new Date(),
                    }
                }
            }
        }));

        try {
            const bulkResult = await db.collection("applications").bulkWrite(operations, { ordered: false });

            // Log a summary so screening runs are auditable
            logger.info(
                `ScreeningRepository.saveScreeningResults: ` +
                `${bulkResult.modifiedCount}/${results.length} applications updated`
            );
        } catch (err: any) {
            // bulkWrite with ordered:false throws a BulkWriteError that contains
            // a writeErrors array — log each failed document individually
            const writeErrors: any[] = err?.writeErrors ?? [];
            if (writeErrors.length > 0) {
                for (const we of writeErrors) {
                    logger.error(
                        `ScreeningRepository: failed to save result for application at index ${we.index}`,
                        { code: we.code, errmsg: we.errmsg }
                    );
                }
            } else {
                // Unexpected error (e.g. network failure) — log and surface it
                logger.error(`ScreeningRepository.saveScreeningResults: unexpected error`, { error: err.message });
            }
        }
    }
}
