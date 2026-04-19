import { getDb } from "@/config/database.js";
import { ObjectId } from "mongodb";
import type { UserJSON, LoginJSON } from "./auth.types.js";

export class AuthRepository {
    async register(user: UserJSON) {
        const db = await getDb();
        const { _id, ...rest } = user;
        const payload = (_id && ObjectId.isValid(_id))
            ? { ...rest, _id: new ObjectId(_id) }
            : rest;
        const result = await db.collection("users").insertOne(payload);
        return result;
    }


    async findByEmail(email: string): Promise<UserJSON | null> {
        const db = await getDb();
        const result = await db.collection("users").findOne({ email });
        return result as UserJSON | null;
    }

    async findById(id: string): Promise<UserJSON | null> {
        if (!ObjectId.isValid(id)) return null;
        const db = await getDb();
        const result = await db.collection("users").findOne({ _id: new ObjectId(id) });
        return result as UserJSON | null;
    }


    async logout(user: any) {
        const db = await getDb();
        const result = await db.collection("users").deleteOne(user);
        return result;
    }
}
