import { getDb } from "@/config/database.js";
import { ObjectId } from "mongodb";
import type { RecruiterJSON } from "./recruiter.types.js";

export class RecruiterRepository {
    private readonly collection = "recruiters";

    /**
     * Create or update a recruiter profile
     */
    async upsertByUserId(userId: string, profile: any): Promise<boolean> {
        const db = await getDb();
        const result = await db.collection(this.collection).updateOne(
            { userId: new ObjectId(userId) },
            {
                $set: {
                    profile,
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    userId: new ObjectId(userId),
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
        return result.acknowledged;
    }

    /**
     * Find recruiter by userId with basic user info joined
     */
    async findByUserId(userId: string): Promise<any | null> {
        const db = await getDb();
        const result = await db.collection(this.collection).aggregate([
            { $match: { userId: new ObjectId(userId) } },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user_details"
                }
            },
            { $unwind: "$user_details" },
            {
                $project: {
                    "user_details.password": 0 // Don't return the password
                }
            }
        ]).toArray();

        return result.length > 0 ? result[0] : null;
    }

    /**
     * Find recruiter by company name (optional helper)
     */
    async findByCompanyName(companyName: string): Promise<RecruiterJSON | null> {
        const db = await getDb();
        const result = await db.collection(this.collection).findOne({ 
            "profile.company_name": companyName 
        });
        return result as RecruiterJSON | null;
    }
}
