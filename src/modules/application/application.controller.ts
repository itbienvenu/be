import type { Request, Response } from "express";
import { ApplicationService } from "./application.service.js";
import logger from "@/shared/utils/logger.js";

export class ApplicationController {
    private service = new ApplicationService();

    /** POST /applications/:jobId — applicant submits application */
    async apply(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            const { jobId } = req.params;
            const { coverLetter } = req.body;

            const application = await this.service.apply(userId, jobId, coverLetter);
            res.status(201).json({ success: true, data: application });
        } catch (error: any) {
            logger.error("APPLY_ERROR", error.message);
            const status = error.message.includes("Forbidden") ? 403
                : error.message.includes("already applied") ? 409
                : error.message.includes("not found") ? 404
                : 400;
            res.status(status).json({ success: false, message: error.message });
        }
    }

    /** GET /applications/my — applicant views their own applications */
    async getMyApplications(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            const data = await this.service.getMyApplications(userId);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            logger.error("GET_MY_APPLICATIONS_ERROR", error.message);
            res.status(500).json({ success: false, message: "Failed to fetch applications" });
        }
    }

    /** GET /applications/job/:jobId — recruiter views applications for their job */
    async getJobApplications(req: Request, res: Response) {
        try {
            const recruiterUserId = (req as any).user?._id;
            const { jobId } = req.params;
            const data = await this.service.getJobApplications(jobId, recruiterUserId);
            res.status(200).json({ success: true, data });
        } catch (error: any) {
            logger.error("GET_JOB_APPLICATIONS_ERROR", error.message);
            const status = error.message.includes("Forbidden") ? 403 : 500;
            res.status(status).json({ success: false, message: error.message });
        }
    }

    /** PATCH /applications/:applicationId/status — recruiter updates status */
    async updateStatus(req: Request, res: Response) {
        try {
            const { applicationId } = req.params;
            const { status } = req.body;

            const validStatuses = ["pending", "reviewed", "shortlisted", "rejected", "hired"];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
            }

            const result = await this.service.updateStatus(applicationId, status);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("UPDATE_STATUS_ERROR", error.message);
            res.status(404).json({ success: false, message: error.message });
        }
    }
}
