import { getDb } from "@/config/database.js";
import { ObjectId } from "mongodb";
import type { ApplicantJSON } from "./applicant.types.js";
import { cache } from "@/shared/utils/cache.js";

export class ApplicantRepository {
    private readonly collection = "applicants";

    async createImported(data: Omit<ApplicantJSON, "_id">): Promise<ApplicantJSON> {
        const db = await getDb();
        
        // Safety: Ensure userId is stored as an ObjectId for consistent joins across the platform
        const payload: any = {
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (data.userId && ObjectId.isValid(data.userId)) {
            payload.userId = new ObjectId(data.userId);
        }

        const result = await db.collection(this.collection).insertOne(payload);
        return {
            ...payload,
            _id: result.insertedId.toString()
        };
    }

    /**
     * Create or update an applicant profile by userId
     */
    async upsertByUserId(userId: string, data: Omit<ApplicantJSON, "_id" | "userId">): Promise<boolean> {
        const db = await getDb();
        const { _id, userId: _, ...sanitizedData } = data as any;
        
        // Handle both nested profile.email and flat "profile.email" keys
        const email = sanitizedData.profile?.email || 
                      sanitizedData.profile?.Email || 
                      sanitizedData["profile.email"] || 
                      sanitizedData["profile.Email"];

        const userObjectId = ObjectId.isValid(userId) ? new ObjectId(userId) : userId;

        // 1. Check if this email belongs to a "ghost" profile (imported CV without a userId)
        if (email) {
            const existingByEmail = await db.collection(this.collection).findOne({
                $or: [{ "profile.email": email }, { "profile.Email": email }],
                userId: { $ne: userObjectId }
            });

            if (existingByEmail && !existingByEmail.userId) {
                const currentProfile = await db.collection(this.collection).findOne({ userId: userObjectId });
                
                const mergePayload: any = { 
                    userId: userObjectId, 
                    updatedAt: new Date() 
                };

                // Preserve CV fields from the temporary record if the ghost doesn't have them
                if (currentProfile) {
                    if (currentProfile.cvRawText) mergePayload.cvRawText = currentProfile.cvRawText;
                    if (currentProfile.cvUrl) mergePayload.cvUrl = currentProfile.cvUrl;
                    if (currentProfile.cvPublicId) mergePayload.cvPublicId = currentProfile.cvPublicId;
                }

                // 1. Update the ghost profile first to become the main profile
                await db.collection(this.collection).updateOne(
                    { _id: existingByEmail._id },
                    { $set: mergePayload }
                );

                // 2. Delete the redundant temporary record if it exists
                // We exclude the record we just updated using its _id
                await db.collection(this.collection).deleteOne({ 
                    userId: userObjectId, 
                    _id: { $ne: existingByEmail._id } 
                });
            }
        }

        // 2. Standard Upsert
        const query = { userId: userObjectId };
        const result = await db.collection(this.collection).updateOne(
            query,
            {
                $set: {
                    ...sanitizedData,
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    userId: userObjectId,
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
        
        if (result.acknowledged) {
            cache.delete(`applicant:${userId}`);
        }
        return result.acknowledged;
    }

    /**
     * Find applicant profile by userId with basic user info joined
     */
    async findByUserId(userId: string): Promise<any | null> {
        const cacheKey = `applicant:${userId}`;
        const cached = cache.get<any>(cacheKey);
        if (cached) return cached;

        const db = await getDb();
        const matchQuery = ObjectId.isValid(userId)
            ? { userId: new ObjectId(userId) }
            : { userId: userId };

        const result = await db.collection(this.collection).aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user_details"
                }
            },
            { $unwind: { path: "$user_details", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    "user_details.password": 0 // Don't return the password
                }
            }
        ]).toArray();

        const found = result.length > 0 ? result[0] : null;
        if (found) {
            cache.set(cacheKey, found, 60 * 1000); // 1 minute cache
        }
        return found;
    }

    /**
     * Patch specific fields using dot notation to avoid overwriting untouched fields
     */
    async patchByUserId(userId: string, flatUpdate: Record<string, any>): Promise<boolean> {
        const db = await getDb();
        const query = ObjectId.isValid(userId)
            ? { userId: new ObjectId(userId) }
            : { userId: userId };

        const result = await db.collection(this.collection).updateOne(
            query,
            { $set: { ...flatUpdate, updatedAt: new Date() } }
        );
        if (result.matchedCount > 0) {
            cache.delete(`applicant:${userId}`);
        }
        return result.matchedCount > 0;
    }

    /**
     * Find applicant by email stored in profile
     */
    async findByEmail(email: string): Promise<any | null> {
        const db = await getDb();
        // Check both 'Email' (sourcing spec) and 'email' (platform spec)
        const result = await db.collection(this.collection).findOne({
            $or: [
                { "profile.Email": email },
                { "profile.email": email }
            ]
        });
        return result;
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
