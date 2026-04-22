
import { getDb } from "./config/database.js";
import logger from "./shared/utils/logger.js";

async function initIndexes() {
    try {
        const db = await getDb();
        logger.info("Initializing database indexes...");

        await db.collection("jobs").createIndex({ recruiterId: 1 });
        await db.collection("jobs").createIndex({ "metadata.status": 1 });

        await db.collection("applicants").createIndex({ "profile.email": 1 }, { unique: true, sparse: true });
        await db.collection("applicants").createIndex({ "profile.Email": 1 }, { sparse: true });
        await db.collection("applicants").createIndex({ userId: 1 }, { unique: true, sparse: true });

        await db.collection("applications").createIndex({ jobId: 1 });
        await db.collection("applications").createIndex({ applicantId: 1 });
        await db.collection("applications").createIndex({ jobId: 1, applicantId: 1 }, { unique: true });
        await db.collection("applications").createIndex({ status: 1 });

        logger.info("Database indexes initialized successfully.");
    } catch (error) {
        logger.error("Failed to initialize database indexes", error);
    }
}


export { initIndexes };
