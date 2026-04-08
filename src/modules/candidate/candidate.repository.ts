import { getDb } from "@/config/database.js";
import { ObjectId } from "mongodb";
import { type Candidate } from "./candidate.types.js";

export class CandidateRepository {
    private collectionName = "candidates";

    async create(data: Candidate) {
        const db = await getDb();
        const payload = {
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection(this.collectionName).insertOne(payload as any);
        return { ...payload, _id: result.insertedId };
    }

    async findByEmail(email: string) {
        const db = await getDb();
        return await db.collection(this.collectionName).findOne({ email });
    }

    async findById(id: string) {
        const db = await getDb();
        return await db.collection(this.collectionName).findOne({ _id: new ObjectId(id) });
    }
}
