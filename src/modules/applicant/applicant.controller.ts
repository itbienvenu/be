import type { Request, Response } from "express";
import { ApplicantService } from "./applicant.service.js";
import logger from "@/shared/utils/logger.js";

export class ApplicantController {
    private applicantService: ApplicantService;

    constructor() {
        this.applicantService = new ApplicantService();
    }

    async uploadCV(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
            if (!req.file) return res.status(400).json({ success: false, message: "No CV file uploaded" });

            const data = await this.applicantService.uploadAndProcessCV(userId, req.file.buffer);
            if (!data) return res.status(500).json({ success: false, message: "Failed to parse CV" });

            res.status(200).json({
                success: true,
                message: "CV parsed successfully. Please review and confirm the details.",
                data
            });
        } catch (error: any) {
            logger.error("UPLOAD_CV_ERROR", error);
            res.status(500).json({ success: false, message: error.message || "Internal server error" });
        }
    }

    async saveProfile(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

            const updatedProfile = await this.applicantService.updateProfile(userId, req.body);
            if (!updatedProfile) return res.status(500).json({ success: false, message: "Failed to save profile" });

            res.status(200).json({ success: true, message: "Profile saved successfully", data: updatedProfile });
        } catch (error: any) {
            logger.error("SAVE_PROFILE_ERROR", error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async getProfile(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

            const profile = await this.applicantService.getProfile(userId);
            if (!profile) return res.status(404).json({ success: false, message: "Applicant profile not found" });

            res.status(200).json({ success: true, data: profile });
        } catch (error: any) {
            logger.error("GET_PROFILE_ERROR", error);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async patchProfile(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

            const updated = await this.applicantService.patchProfile(userId, req.body);
            if (!updated) return res.status(500).json({ success: false, message: "Failed to update profile" });

            res.status(200).json({ success: true, message: "Profile updated successfully" });
        } catch (error: any) {
            logger.error("PATCH_PROFILE_ERROR", error.message);
            const status = error.message === "Profile not found" ? 404 : 500;
            res.status(status).json({ success: false, message: error.message });
        }
    }

    async generateCoverLetter(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

            const { jobId } = req.params;
            const { cvText, instructions } = req.body;
            if (!jobId) {
                return res.status(400).json({ success: false, message: "Job ID is required in URL" });
            }

            const result = await this.applicantService.generateCoverLetter(userId, {
                jobId: jobId as string,
                cvText: cvText as string,
                instructions: instructions as string,
                cvFile: req.file ? req.file.buffer : undefined
            });

            res.status(200).json({
                success: true,
                message: "Cover letter generated successfully",
                data: result
            });
        } catch (error: any) {
            logger.error("GENERATE_COVER_LETTER_ERROR", error.message);
            res.status(500).json({ success: false, message: error.message || "Internal server error" });
        }
    }
}
