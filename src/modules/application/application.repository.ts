import { getDb } from "@/config/database.js";
import { ObjectId } from "mongodb";
import type { ApplicationJSON } from "./application.types.js";

export class ApplicationRepository {
    private readonly collection = "applications";

    async create(data: Omit<ApplicationJSON, "_id">): Promise<ApplicationJSON> {
        const db = await getDb();
        const result = await db.collection(this.collection).insertOne({
            ...data,
            applicantId: new ObjectId(data.applicantId),
            jobId: new ObjectId(data.jobId),
        });
        return { ...data, _id: result.insertedId.toString() };
    }

    /** Prevent duplicate applications */
    async findByApplicantAndJob(applicantId: string, jobId: string): Promise<ApplicationJSON | null> {
        const db = await getDb();
        const result = await db.collection(this.collection).findOne({
            applicantId: new ObjectId(applicantId),
            jobId: new ObjectId(jobId),
        });
        return result as ApplicationJSON | null;
    }

    /** Get all applications submitted by an applicant */
    async findByApplicantId(applicantId: string): Promise<any[]> {
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
            { $project: { "job.scoring_config": 0, "job.skills.weight": 0, "job.soft_skills.weight": 0 } }
        ]).toArray();
    }

    /** Get all applications for a job (recruiter view) */
    async findByJobId(jobId: string): Promise<any[]> {
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

    /** Update application status */
    async updateStatus(applicationId: string, status: ApplicationJSON["status"]): Promise<boolean> {
        const db = await getDb();
        const result = await db.collection(this.collection).updateOne(
            { _id: new ObjectId(applicationId) },
            { $set: { status, updatedAt: new Date() } }
        );
        return result.modifiedCount > 0;
    }
}
