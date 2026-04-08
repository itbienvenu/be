import dotenv from 'dotenv';
import { Db, MongoClient } from 'mongodb';
dotenv.config();

const mongodbUri = process.env.MONGODB_URI;

if (!mongodbUri) {
	throw new Error('MONGODB_URI is missing in environment variables');
}

const client = new MongoClient(mongodbUri, {
	serverSelectionTimeoutMS: 10000,
	tlsAllowInvalidCertificates: process.env.MONGODB_TLS_ALLOW_INVALID_CERTS === 'true',
});

let dbPromise: Promise<Db> | null = null;

export async function getDb(): Promise<Db> {
	if (dbPromise) return dbPromise;

	dbPromise = (async () => {
		try {
			await client.connect();
			console.log('Mongo connected');
			return client.db(process.env.MONGODB_DB_NAME || 'umurava');
		} catch (error) {
			dbPromise = null;

			const err = error as Error;
			if (/SSL|TLS|alert/i.test(err.message)) {
				console.error(
					'Mongo TLS handshake failed. Check Atlas IP whitelist, URI credentials, local network/proxy, and try Node 20 LTS if you are on Node 22.'
				);
			}

			throw error;
		}
	})();

	return dbPromise;
}