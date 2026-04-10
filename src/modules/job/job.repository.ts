import { getDb } from "@/config/database.js";
import { ObjectId } from "mongodb";
import { type JobJSON } from "./job.types.js";

export class JobRepository {
    async createJob(data: JobJSON) {
        const db = await getDb();
        const { _id, ...rest } = data;
        const payload = (_id && ObjectId.isValid(_id))
            ? { ...rest, _id: new ObjectId(_id) }
            : rest;

        const job = await db.collection("jobs").insertOne(payload);
        return { success: true, data: job };
    }

    async getAllJobs() {
        const db = await getDb();
        const jobs = await db.collection("jobs").find().toArray();
        return { success: true, data: jobs };
    }

    async getJobById(id: string) {
        const db = await getDb();
        const job = await db.collection("jobs").findOne({ _id: new ObjectId(id) });
        return { success: true, data: job };
    }
}