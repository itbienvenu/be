import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import { requestStorage } from "../../config/storage.js";

const logDir = path.resolve(process.cwd(), "logs");

const requestIdFormat = winston.format((info) => {
    const store = requestStorage.getStore();
    if (store?.requestId) {
        info.requestId = store.requestId;
    }
    return info;
});

// Custom format for terminal - highly readable
const consoleFormat = winston.format.printf(({ timestamp, level, message, requestId, stack }) => {
    const reqId = requestId ? ` [Req: ${requestId}]` : "";
    const errorStack = stack ? `\n${stack}` : "";
    return `${timestamp} [${level.toUpperCase()}]${reqId}: ${message}${errorStack}`;
});

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        requestIdFormat(),
        winston.format.errors({ stack: true }),
    ),
    transports: [],
});

// Always log to console with a pretty format
logger.add(new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        consoleFormat
    )
}));

// In non-production, also log to files
if (process.env.NODE_ENV !== "production") {
    const combinedTransport = new DailyRotateFile({
        filename: path.join(logDir, "combined-%DATE%.log"),
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "30d",
        format: winston.format.json() // Files use JSON for structural logging
    });

    const errorTransport = new DailyRotateFile({
        filename: path.join(logDir, "error-%DATE%.log"),
        level: "error",
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "30d",
        format: winston.format.json()
    });

    logger.add(combinedTransport);
    logger.add(errorTransport);
}

export default logger;