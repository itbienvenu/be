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
     * Fetch all applications eligible for screening (status: pending or reviewed)
     * for a given job, joined with the applicant's profile.
     *
     * Uses a $lookup aggregation so we get the full applicant profile in one query
     * rather than N+1 queries.
     */
    async findEligibleApplications(jobId: string): Promise<ApplicationWithApplicant[]> {
        if (!ObjectId.isValid(jobId)) return [];
        const db = await getDb();

        const results = await db.collection("applications").aggregate([
            // Match only pending/reviewed applications for this job
            { $match: { jobId: new ObjectId(jobId), status: { $in: ["pending", "reviewed"] } } },

            // Join with applicants collection on applicantId → userId
            // Note: applicantId is stored as ObjectId, userId in applicants is also ObjectId
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
            {
                $project: {
                    application_id: { $toString: "$_id" },
                    applicant_id:   { $toString: "$applicantId" },
                    appliedAt:      1,
                    cvRawText:      1,
                    status:         1,
                    profile:        "$applicant.profile"
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
            {
                $project: {
                    application_id:   { $toString: "$_id" },
                    applicant_id:     { $toString: "$applicantId" },
                    first_name:       "$applicant.profile.first_name",
                    last_name:        "$applicant.profile.last_name",
                    headline:         "$applicant.profile.headline",
                    screening_result: 1
                }
            }
        ]).toArray();

        return results as unknown as ShortlistEntry[];
    }

    // ─── Writes ───────────────────────────────────────────────────────────────

    /**
     * Bulk-write screening results back to the applications collection.
     *
     * Each application gets:
     *   - screening_result: the full ScreeningResult object
     *   - status: "shortlisted" or "rejected"
     *   - updatedAt: current UTC timestamp
     *
     * Individual write failures are logged and skipped — we never abort the
     * entire batch because one document failed to update.
     */
    async saveScreeningResults(results: ApplicationUpdate[]): Promise<void> {
        const db = await getDb();

        for (const update of results) {
            try {
                await db.collection("applications").updateOne(
                    { _id: new ObjectId(update.application_id) },
                    {
                        $set: {
                            screening_result: update.screening_result,
                            status:           update.new_status,
                            updatedAt:        new Date(),
                        }
                    }
                );
            } catch (err: any) {
                // Log and continue — one failure must not abort the whole screening run
                logger.error(`ScreeningRepository: failed to save result for application ${update.application_id}`, {
                    error: err.message
                });
            }
        }
    }
}
