import type { Request, Response, NextFunction } from "express";
import { SecurityLayer } from "@/shared/utils/security.js";

interface AuthenticatedRequest extends Request {
    user?: any;
}

export class AuthMiddleware {
    private securityLayer: SecurityLayer;

    constructor() {
        this.securityLayer = new SecurityLayer();
        this.authenticate = this.authenticate.bind(this);
    }

    async authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
            }

            const token = await this.securityLayer.extractTokenFromHeader(authHeader);
            if (!token) {
                return res.status(401).json({ success: false, message: "Unauthorized: Invalid token format. Use Bearer <token>" });
            }

            const user = await this.securityLayer.verifyAccessToken(token);
            if (!user) {
                return res.status(401).json({ success: false, message: "Unauthorized: User not found" });
            }

            req.user = user;
            next();
        } catch (error: any) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({ success: false, message: "Unauthorized: Token has expired" });
            }
            if (error.name === "JsonWebTokenError") {
                return res.status(401).json({ success: false, message: "Unauthorized: Invalid or tampered token" });
            }
            return res.status(401).json({ success: false, message: "Unauthorized: Authentication failed" });
        }
    }

    requireRole(role: string) {
        return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            if (!req.user) {
                return res.status(401).json({ success: false, message: "Unauthorized: Access denied" });
            }
            if (req.user.role !== role) {
                return res.status(403).json({
                    success: false,
                    message: `Forbidden: Access restricted to ${role} only`
                });
            }
            next();
        };
    }
}

