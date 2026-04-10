import type { Request, Response } from "express";
import { ApplicantService } from "./applicant.service.js";
import logger from "@/shared/utils/logger.js";

export class ApplicantController {
    private applicantService: ApplicantService;

    constructor() {
        this.applicantService = new ApplicantService();
    }

    /**
     * Step 1: Handle CV upload and return parsed data for review
     */
    async uploadCV(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            if (!req.file) {
                return res.status(400).json({ success: false, message: "No CV file uploaded" });
            }

            const data = await this.applicantService.uploadAndProcessCV(userId, req.file.buffer);

            if (!data) {
                return res.status(500).json({ success: false, message: "Failed to parse CV" });
            }

            // Return extracted data for review (Status 200)
            res.status(200).json({
                success: true,
                message: "CV parsed successfully. Please review and confirm the details.",
                data: data
            });
        } catch (error: any) {
            logger.error("UPLOAD_CV_ERROR", error.message);
            res.status(500).json({ success: false, message: error.message || "Internal server error" });
        }
    }

    /**
     * Step 2: Save the user-reviewed profile data
     */
    async saveProfile(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }

            const profileData = req.body; // Full reviewed data from frontend
            
            const updatedProfile = await this.applicantService.updateProfile(userId, profileData);

            if (!updatedProfile) {
                return res.status(500).json({ success: false, message: "Failed to save profile" });
            }

            res.status(200).json({
                success: true,
                message: "Profile saved successfully",
                data: updatedProfile
            });
        } catch (error: any) {
            logger.error("SAVE_PROFILE_ERROR", error.message);
            res.status(500).json({ success: false, message: "Internal server error" });
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
