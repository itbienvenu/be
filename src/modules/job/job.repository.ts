import { getDb } from "@/config/database.js";
import { ObjectId } from "mongodb";
import { type JobJSON } from "./job.types.js";
import { NotFoundError, ForbiddenError } from "@/shared/utils/custom-errors.js";

export class JobRepository {
    async createJob(data: JobJSON) {
        const db = await getDb();
        const { _id, recruiterId, ...rest } = data;
        
        if (!recruiterId) {
            throw new Error("recruiterId is required to create a job");
        }

        let payload: any = { 
            ...rest,
            recruiterId: new ObjectId(recruiterId),
            createdAt: new Date() 
        };

        if (_id && ObjectId.isValid(_id)) {
            payload._id = new ObjectId(_id);
        }

        const job = await db.collection("jobs").insertOne(payload);
        return { success: true, data: job };
    }

    async getAllJobs(isPublic: boolean = true) {
        const db = await getDb();
        const pipeline: any[] = [
            {
                $lookup: {
                    from: "recruiters",
                    localField: "recruiterId",
                    foreignField: "userId",
                    as: "recruiter_profile"
                }
            },
            { $unwind: { path: "$recruiter_profile", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "recruiterId",
                    foreignField: "_id",
                    as: "user_details"
                }
            },
            { $unwind: { path: "$user_details", preserveNullAndEmptyArrays: true } }
        ];

        // Zero Trust / Privacy: Omit sensitive weights and scoring config for public view
        const projection: any = {
            "user_details.password": 0,
            "user_details.role": 0
        };

        if (isPublic) {
            projection.scoring_config = 0;
            projection["skills.weight"] = 0;
            projection["soft_skills.weight"] = 0;
        }

        pipeline.push({ $project: projection });

        const jobs = await db.collection("jobs").aggregate(pipeline).toArray();
        return { success: true, data: jobs };
    }

    async getJobById(id: string, isPublic: boolean = true, recruiterId?: string) {
        const db = await getDb();
        
        // Safety check: ensure id is a valid ObjectId
        if (!ObjectId.isValid(id)) {
            return { success: true, data: null };
        }

        const match: any = { _id: new ObjectId(id) };
        
        // Zero Trust: If for recruiter view, ensure they own the job
        if (!isPublic && recruiterId) {
            match.recruiterId = new ObjectId(recruiterId);
        }

        const pipeline: any[] = [
            { $match: match },
            {
                $lookup: {
                    from: "recruiters",
                    localField: "recruiterId",
                    foreignField: "userId",
                    as: "recruiter_profile"
                }
            },
            { $unwind: { path: "$recruiter_profile", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "recruiterId",
                    foreignField: "_id",
                    as: "user_details"
                }
            },
            { $unwind: { path: "$user_details", preserveNullAndEmptyArrays: true } }
        ];

        const projection: any = {
            "user_details.password": 0,
            "user_details.role": 0
        };

        if (isPublic) {
            projection.scoring_config = 0;
            projection["skills.weight"] = 0;
            projection["soft_skills.weight"] = 0;
        }

        pipeline.push({ $project: projection });

        const jobs = await db.collection("jobs").aggregate(pipeline).toArray();
        return { success: true, data: jobs.length > 0 ? jobs[0] : null };
    }

    async getJobsByRecruiter(recruiterId: string) {
        if (!recruiterId || !ObjectId.isValid(recruiterId)) {
            return { success: true, data: [] };
        }
        const db = await getDb();
        const jobs = await db.collection("jobs").aggregate([
            { $match: { recruiterId: new ObjectId(recruiterId) } },
            {
                $lookup: {
                    from: "recruiters",
                    localField: "recruiterId",
                    foreignField: "userId",
                    as: "recruiter_profile"
                }
            },
            { $unwind: { path: "$recruiter_profile", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "recruiterId",
                    foreignField: "_id",
                    as: "user_details"
                }
            },
            { $unwind: { path: "$user_details", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    "user_details.password": 0,
                    "user_details.role": 0
                }
            }
        ]).toArray();
        return { success: true, data: jobs };
    }

    async patchJob(id: string, recruiterId: string, fields: Record<string, any>): Promise<boolean> {
        const db = await getDb();
        if (!ObjectId.isValid(id)) throw new Error("Invalid job ID");
        if (!ObjectId.isValid(recruiterId)) throw new Error("Invalid recruiter ID");

        // Allowlist of editable fields - blocks sensitive fields like _id, recruiterId, metadata.status, scoring_config
        const allowedFields = new Set([
            "title",
            "company",
            "employment_type",
            "seniority_level",
            "description",
            "requirements",
            "skills",
            "resources",
            "domain",
            "responsibilities",
            "soft_skills",
            "physical_requirements",
            "languages",
            "work_conditions",
            "travel_required"
        ]);

        const flatUpdate: Record<string, any> = { "metadata.updated_at": new Date().toISOString() };
        for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined && allowedFields.has(key)) {
                flatUpdate[key] = value;
            }
        }

        const result = await db.collection("jobs").updateOne(
            { _id: new ObjectId(id), recruiterId: new ObjectId(recruiterId), "metadata.status": "draft" },
            { $set: flatUpdate }
        );

        if (result.matchedCount === 0) {
            const exists = await db.collection("jobs").countDocuments({ _id: new ObjectId(id) });
            if (exists === 0) throw new NotFoundError("Job not found");
            const owned = await db.collection("jobs").countDocuments({ _id: new ObjectId(id), recruiterId: new ObjectId(recruiterId) });
            if (owned === 0) throw new ForbiddenError("You do not own this job");
            throw new Error("Job is not in draft state and cannot be edited");
        }
        return result.acknowledged;
    }

    async publishJob(id: string, recruiterId: string): Promise<boolean> {
        const db = await getDb();
        if (!ObjectId.isValid(id)) throw new Error("Invalid job ID");

        const result = await db.collection("jobs").updateOne(
            { _id: new ObjectId(id), recruiterId: new ObjectId(recruiterId), "metadata.status": "draft" },
            { $set: { "metadata.status": "published", "metadata.updated_at": new Date().toISOString() } }
        );

        if (result.matchedCount === 0) {
            const exists = await db.collection("jobs").countDocuments({ _id: new ObjectId(id) });
            if (exists === 0) throw new NotFoundError("Job not found");
            const owned = await db.collection("jobs").countDocuments({ _id: new ObjectId(id), recruiterId: new ObjectId(recruiterId) });
            if (owned === 0) throw new ForbiddenError("You do not own this job");
            throw new Error("Job is not in draft state and cannot be published");
        }
        return result.acknowledged;
    }
}