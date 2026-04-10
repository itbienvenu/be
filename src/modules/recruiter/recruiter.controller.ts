import type { Request, Response } from "express";
import { RecruiterService } from "./recruiter.service.js";
import { SchemaValidator } from "@/shared/utils/security.js";
import schema from "./recruiter.schema.json" with { type: "json" };
import logger from "@/shared/utils/logger.js";

export class RecruiterController {
    private recruiterService: RecruiterService;
    private validator: SchemaValidator;

    constructor() {
        this.recruiterService = new RecruiterService();
        this.validator = new SchemaValidator();
    }

    /**
     * Create or update profile
     */
    async updateProfile(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const profileData = req.body;

            // Validate schema
            const validation = this.validator.validate(schema, profileData);
            if (!validation.valid) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Validation failed", 
                    errors: validation.errors 
                });
            }

            const profile = await this.recruiterService.updateProfile(userId, profileData);

            if (!profile) {
                return res.status(500).json({ success: false, message: "Failed to save profile" });
            }

            res.status(200).json({
                success: true,
                message: "Recruiter profile saved successfully",
                data: profile
            });
        } catch (error: any) {
            logger.error("RECRUITER_UPDATE_ERROR", error.message);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    /**
     * Get profile
     */
    async getProfile(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const profile = await this.recruiterService.getProfile(userId);

            if (!profile) {
                return res.status(404).json({ success: false, message: "Recruiter profile not found" });
            }

            res.status(200).json({
                success: true,
                data: profile
            });
        } catch (error: any) {
            logger.error("RECRUITER_GET_ERROR", error.message);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}
