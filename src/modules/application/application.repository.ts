import { getDb } from "@/config/database.js";
import { ObjectId } from "mongodb";
import type { ApplicationJSON, ApplicationDetail, ApplicationMyView } from "./application.types.js";

export class ApplicationRepository {
    private readonly collection = "applications";

    async create(data: Omit<ApplicationJSON, "_id">): Promise<ApplicationJSON> {
        if (!ObjectId.isValid(data.applicantId)) throw new Error("Invalid applicantId");
        if (!ObjectId.isValid(data.jobId)) throw new Error("Invalid jobId");
        const db = await getDb();
        const result = await db.collection(this.collection).insertOne({
            ...data,
            applicantId: new ObjectId(data.applicantId),
            jobId: new ObjectId(data.jobId),
        });
        return { ...data, _id: result.insertedId.toString() };
    }

    /** Check if an applicant has any existing application (across all jobs) */
    async findAnyByApplicantId(applicantId: string): Promise<ApplicationJSON | null> {
        if (!ObjectId.isValid(applicantId)) return null;
        const db = await getDb();
        const result = await db.collection(this.collection).findOne({
            applicantId: new ObjectId(applicantId),
        });
        return result as ApplicationJSON | null;
    }

    /** Prevent duplicate applications */
    async findByApplicantAndJob(applicantId: string, jobId: string): Promise<ApplicationJSON | null> {
        if (!ObjectId.isValid(applicantId) || !ObjectId.isValid(jobId)) return null;
        const db = await getDb();
        const result = await db.collection(this.collection).findOne({
            applicantId: new ObjectId(applicantId),
            jobId: new ObjectId(jobId),
        });
        return result as ApplicationJSON | null;
    }

    /** Get all applications submitted by an applicant — minimal follow-up view */
    async findByApplicantId(applicantId: string): Promise<ApplicationMyView[]> {
        if (!ObjectId.isValid(applicantId)) return [];
        const db = await getDb();
        return db.collection(this.collection).aggregate([
            { $match: { applicantId: new ObjectId(applicantId) } },
            {
                $lookup: {
                    from: "jobs",
                    localField: "jobId",
                    foreignField: "_id",
                    as: "job"
                }
            },
            { $unwind: { path: "$job", preserveNullAndEmptyArrays: true } },
            {
                // Return only what the applicant needs to follow up:
                // application status, when they applied, and basic job info
                $project: {
                    _id: 1,
                    status: 1,
                    appliedAt: 1,
                    updatedAt: 1,
                    coverLetter: 1,
                    // Screening result — only rank and final score, not the full breakdown
                    "screening_result.rank":        1,
                    "screening_result.final_score": 1,
                    "screening_result.recommendation": 1,
                    "screening_result.screened_at": 1,
                    // Minimal job info
                    "job._id":                1,
                    "job.title":              1,
                    "job.seniority_level":    1,
                    "job.employment_type":    1,
                    "job.company.name":       1,
                    "job.company.location":   1,
                    "job.domain.primary":     1,
                    "job.metadata.status":    1,
                    "job.description.summary": 1,
                }
            },
            { $sort: { appliedAt: -1 } }
        ]).toArray() as Promise<ApplicationMyView[]>;
    }

    /** Get all applications for a job (recruiter view) */
    async findByJobId(jobId: string): Promise<any[]> {
        if (!ObjectId.isValid(jobId)) return [];
        const db = await getDb();
        return db.collection(this.collection).aggregate([
            { $match: { jobId: new ObjectId(jobId) } },
            {
                $lookup: {
                    from: "applicants",
                    localField: "applicantId",
                    foreignField: "userId",
                    as: "applicant"
                }
            },
            { $unwind: { path: "$applicant", preserveNullAndEmptyArrays: true } },
            { $project: { "applicant.cvPublicId": 0 } }
        ]).toArray();
    }

    /** Get a single application by ID — joined with job info (used by both applicant and recruiter) */
    async findById(applicationId: string): Promise<ApplicationDetail | null> {
        if (!ObjectId.isValid(applicationId)) return null;
        const db = await getDb();
        const results = await db.collection(this.collection).aggregate([
            { $match: { _id: new ObjectId(applicationId) } },
            {
                $lookup: {
                    from: "jobs",
                    localField: "jobId",
                    foreignField: "_id",
                    as: "job"
                }
            },
            { $unwind: { path: "$job", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    applicantId: 1,
                    jobId: 1,
                    status: 1,
                    appliedAt: 1,
                    updatedAt: 1,
                    coverLetter: 1,
                    screening_result: 1,
                    "job._id":               1,
                    "job.title":             1,
                    "job.seniority_level":   1,
                    "job.employment_type":   1,
                    "job.company":           1,
                    "job.domain.primary":    1,
                    "job.metadata.status":   1,
                    "job.description.summary": 1,
                }
            }
        ]).toArray();
        return (results[0] ?? null) as ApplicationDetail | null;
    }

    /** Update application status */
    async updateStatus(applicationId: string, status: ApplicationJSON["status"]): Promise<boolean> {
        if (!ObjectId.isValid(applicationId)) return false;
        const db = await getDb();
        const result = await db.collection(this.collection).updateOne(
            { _id: new ObjectId(applicationId) },
            { $set: { status, updatedAt: new Date() } }
        );
        return result.modifiedCount > 0;
    }

    async getApplicantStats(applicantId: string) {
        if (!ObjectId.isValid(applicantId)) return null;
        const db = await getDb();
        const aid = new ObjectId(applicantId);

        const totalApplications = await db.collection(this.collection).countDocuments({ applicantId: aid });
        
        const recentApplications = await db.collection(this.collection).aggregate([
            { $match: { applicantId: aid } },
            {
                $lookup: {
                    from: "jobs",
                    localField: "jobId",
                    foreignField: "_id",
                    as: "job"
                }
            },
            { $unwind: "$job" },
            {
                $project: {
                    _id: 1,
                    status: 1,
                    appliedAt: 1,
                    "job.title": 1,
                    "job.company.name": 1
                }
            },
            { $sort: { appliedAt: -1 } },
            { $limit: 5 }
        ]).toArray();

        return {
            totalApplications,
            recentApplications
        };
    }
}
