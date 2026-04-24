import dotenv from 'dotenv';
import { Db, MongoClient } from 'mongodb';
import logger from '../shared/utils/logger.js';
dotenv.config();

const mongodbUri = process.env.MONGODB_URI;

if (!mongodbUri) {
	throw new Error('MONGODB_URI is missing in environment variables');
}

const allowInvalidCerts = process.env.MONGODB_TLS_ALLOW_INVALID_CERTS === 'true';
const allowDevOverride = process.env.ALLOW_DEVELOPMENT_CERTS === 'true';

if (allowInvalidCerts && !allowDevOverride) {
	throw new Error(
		'SECURITY ALERT: MONGODB_TLS_ALLOW_INVALID_CERTS is enabled but ALLOW_DEVELOPMENT_CERTS is not. ' +
		'This option bypasses TLS certificate verification and should NEVER be used in production. ' +
		'If you are in a local development environment, set ALLOW_DEVELOPMENT_CERTS=true to proceed.'
	);
}

const client = new MongoClient(mongodbUri, {
	serverSelectionTimeoutMS: 30000,
	tlsAllowInvalidCertificates: allowInvalidCerts,
});

let dbPromise: Promise<Db> | null = null;

export async function getDb(): Promise<Db> {
	if (dbPromise) return dbPromise;

	dbPromise = (async () => {
		try {
			await client.connect();
			logger.info('Mongo connected');
			return client.db(process.env.MONGODB_DB_NAME || 'umurava');
		} catch (error) {
			dbPromise = null;

			const err = error as Error;
			if (/SSL|TLS|alert/i.test(err.message)) {
				logger.error(
					'Mongo TLS handshake failed. Check Atlas IP whitelist, URI credentials, local network/proxy, and try Node 20 LTS if you are on Node 22.'
				);
			} else if (/selection timed out/i.test(err.message)) {
				logger.error(
					'Mongo connection timed out. This is usually caused by your IP address not being whitelisted in MongoDB Atlas or a firewall blocking the connection.'
				);
			}

			throw error;
		}
	})();

	return dbPromise;
}

export async function closeConnection(): Promise<void> {
	await client.close();
	logger.info('Mongo disconnected');
}