import { type Request, type Response, type NextFunction } from "express";
import { requestStorage } from "../../config/storage.js";
import logger from "../utils/logger.js";
import crypto from "crypto";

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const requestId = crypto.randomUUID();

    // Run the request inside the AsyncLocalStorage context
    requestStorage.run({ requestId }, () => {
        const { method, url } = req;
        const start = Date.now();

        // Log when the request arrives
        logger.info(`Incoming Request: ${method} ${url}`);

        // Log when the request finishes
        res.on("finish", () => {
            const duration = Date.now() - start;
            const status = res.statusCode;
            logger.info(`Completed: ${method} ${url} - Status: ${status} [${duration}ms]`);
        });

        next();
    });
};
