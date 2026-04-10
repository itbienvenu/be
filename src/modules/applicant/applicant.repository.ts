import { getDb } from "@/config/database.js";
import { ObjectId } from "mongodb";
import type { ApplicantJSON } from "./applicant.types.js";

export class ApplicantRepository {
    private readonly collection = "applicants";

    /**
     * Create or update an applicant profile by userId
     */
    async upsertByUserId(userId: string, data: Omit<ApplicantJSON, "_id" | "userId">): Promise<boolean> {
        const db = await getDb();
        const result = await db.collection(this.collection).updateOne(
            { userId: new ObjectId(userId) },
            {
                $set: {
                    ...data,
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
     * Find applicant profile by userId
     */
    async findByUserId(userId: string): Promise<ApplicantJSON | null> {
        const db = await getDb();
        const result = await db.collection(this.collection).findOne({ 
            userId: new ObjectId(userId) 
        });
        return result as ApplicantJSON | null;
    }

    /**
     * Delete applicant profile by userId
     */
    async deleteByUserId(userId: string): Promise<boolean> {
        const db = await getDb();
        const result = await db.collection(this.collection).deleteOne({ 
            userId: new ObjectId(userId) 
        });
        return result.deletedCount > 0;
    }
}
