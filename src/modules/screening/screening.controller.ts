import type { Request, Response } from "express";
import { ScreeningService } from "./screening.service.js";
import logger from "@/shared/utils/logger.js";

export class ScreeningController {
    private service = new ScreeningService();

    /**
     * POST /jobs/:jobId/screen
     *
     * Triggers AI screening for all eligible applications on a job.
     * Only the recruiter who owns the job can trigger this.
     */
    async triggerScreening(req: Request, res: Response) {
        try {
            const recruiterId = (req as any).user?._id;
            const jobId       = req.params.jobId as string;

            // Start background screening
            this.service.screen(jobId, recruiterId).catch(err => {
                logger.error(`[ScreeningController] Background screening failed for job ${jobId}: ${err.message}`);
            });

            res.status(202).json({ 
                success: true, 
                message: "AI screening has started. It may take a minute to process all candidates. Please refresh the shortlist shortly." 
            });
        } catch (error: any) {
            const message = error?.message ?? String(error);
            const stack   = error?.stack   ?? "";
            logger.error(`SCREENING_TRIGGER_ERROR: ${message}`, { stack, jobId: String(req.params.jobId ?? "") });
            const status = message.toLowerCase().includes("forbidden") || error?.status === 403 || error?.statusCode === 403 ? 403 : 500;
            res.status(status).json({ success: false, message });
        }
    }

    /**
     * GET /jobs/:jobId/shortlist?limit=10|20
     *
     * Returns the persisted ranked shortlist for a job.
     * limit must be 10 or 20 (defaults to 10 if not provided).
     */
    async getShortlist(req: Request, res: Response) {
        try {
            const recruiterId  = (req as any).user?._id;
            const jobId        = req.params.jobId as string;
            const rawLimit     = req.query.limit;

            // Validate limit — must be 10 or 20 if provided
            let limit: 10 | 20 = 10;
            if (rawLimit !== undefined) {
                const parsed = Number(rawLimit);
                if (parsed !== 10 && parsed !== 20) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid limit. Must be 10 or 20."
                    });
                }
                limit = parsed as 10 | 20;
            }

            const cacheKey = `shortlist:${jobId}:${limit}`;
            const { cache } = await import("@/shared/utils/cache.js");
            const cached = cache.get<any[]>(cacheKey);
            if (cached) {
                return res.status(200).json({ success: true, data: cached });
            }

            const shortlist = await this.service.getShortlist(jobId, recruiterId, limit);
            cache.set(cacheKey, shortlist, 30 * 1000); // 30 seconds cache
            res.status(200).json({ success: true, data: shortlist });
        } catch (error: any) {
            const message = error?.message ?? String(error);
            const stack   = error?.stack   ?? "";
            logger.error(`SHORTLIST_GET_ERROR: ${message}`, { stack, jobId: String(req.params.jobId ?? "") });
            const status = message.toLowerCase().includes("forbidden") || error?.status === 403 || error?.statusCode === 403 ? 403 : 500;
            res.status(status).json({ success: false, message });
        }
    }
}
