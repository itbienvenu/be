import type { Request, Response } from "express";
import { ApplicantService } from "./applicant.service.js";
import logger from "@/shared/utils/logger.js";

export class ApplicantController {
    private applicantService: ApplicantService;

    constructor() {
        this.applicantService = new ApplicantService();
    }

    /**
     * Handle CV upload and processing
     */
    async uploadCV(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id; // Assuming auth middleware attaches user
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized: User not found" });
            }

            if (!req.file) {
                return res.status(400).json({ success: false, message: "No CV file uploaded" });
            }

            const applicant = await this.applicantService.uploadAndProcessCV(userId, req.file.buffer);

            if (!applicant) {
                return res.status(500).json({ success: false, message: "Failed to process applicant profile" });
            }

            res.status(200).json({
                success: true,
                message: "CV processed and profile updated successfully",
                data: applicant
            });
        } catch (error: any) {
            logger.error("UPLOAD_CV_ERROR", error.message);
            res.status(500).json({ success: false, message: error.message || "Internal server error" });
        }
    }

    /**
     * Get the current applicant's profile
     */
    async getProfile(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const profile = await this.applicantService.getProfile(userId);

            if (!profile) {
                return res.status(404).json({ success: false, message: "Applicant profile not found" });
            }

            res.status(200).json({
                success: true,
                data: profile
            });
        } catch (error: any) {
            logger.error("GET_PROFILE_ERROR", error.message);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}
