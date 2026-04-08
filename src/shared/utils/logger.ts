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


const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        requestIdFormat(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [],
});

if (process.env.NODE_ENV === "production") {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        )
    }));
} else {
    const combinedTransport = new DailyRotateFile({
        filename: path.join(logDir, "combined-%DATE%.log"),
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "30d",
    });

    const errorTransport = new DailyRotateFile({
        filename: path.join(logDir, "error-%DATE%.log"),
        level: "error",
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxSize: "20m",
        maxFiles: "30d",
    });

    logger.add(combinedTransport);
    logger.add(errorTransport);
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

export default logger;