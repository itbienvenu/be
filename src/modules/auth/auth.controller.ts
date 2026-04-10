import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import type { UserJSON, LoginJSON } from "./auth.types.js";
import logger from "@/shared/utils/logger.js";
import { SecurityLayer } from "@/shared/utils/security.js";
import { AuthRepository } from "./auth.repository.js";
import schema from "./auth.schema.json" with { type: "json" };
import { SchemaValidator } from "@/shared/utils/security.js";


export class AuthController {
    private readonly securityLayer: SecurityLayer;
    private readonly authService: AuthService;
    private readonly schemaValidator: SchemaValidator;

    constructor() {
        this.securityLayer = new SecurityLayer();
        this.authService = new AuthService(new AuthRepository());
        this.schemaValidator = new SchemaValidator();
    }

    async register(req: Request, res: Response) {
        try {
            const user = req.body as UserJSON;
            const validation = this.schemaValidator.validate(schema.definitions.register, user);
            if (!validation.valid) {
                logger.error("REGISTER_ERROR", validation.errors);
                return res.status(400).json({ success: false, message: "Invalid request body", errors: validation.errors });
            }
            const result = await this.authService.register({
                name: user.name,
                email: user.email,
                password: await this.securityLayer.hashPassword(user.password),
                role: user.role
            });
            if (!result.success) {
                const statusCode = result.message === "User already exists" ? 409 : 400;
                return res.status(statusCode).json(result);
            }
            res.status(201).json(result);
        } catch (error) {
            logger.error("REGISTER_ERROR", error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async login(req: Request, res: Response) {
        try {
            const user = req.body as LoginJSON;
            const validation = this.schemaValidator.validate(schema.definitions.login, user);
            if (!validation.valid) {
                logger.error("LOGIN_ERROR", validation.errors);
                return res.status(400).json({ success: false, message: "Invalid request body", errors: validation.errors });
            }
            const result = await this.authService.login(user);
            if (!result.success) {
                const statusCode = result.message === "User not found" ? 404 : 400;
                return res.status(statusCode).json(result);
            }
            res.json(result);
        } catch (error) {
            logger.error("LOGIN_ERROR", error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

export default AuthController;