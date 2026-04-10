import type { Request, Response, NextFunction } from "express";
import { SecurityLayer } from "@/shared/utils/security.js";
import logger from "@/shared/utils/logger.js";

const securityLayer = new SecurityLayer();

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: "Authorization header missing" });
        }

        const token = await securityLayer.extractTokenFromHeader(authHeader);
        if (!token) {
            return res.status(401).json({ success: false, message: "Invalid token format" });
        }

        const decoded = await securityLayer.verifyAccessToken(token);
        (req as any).user = decoded;
        next();
    } catch (error: any) {
        logger.error("AUTH_MIDDLEWARE_ERROR", error.message);
        res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};
