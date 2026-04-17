import { JobService } from "./job.service.js";
import { JobAIService } from "../ai/ai.service.js";
import { type Request, type Response } from "express";
import logger from "@/shared/utils/logger.js";


export class JobController {
    private jobService: JobService;
    private jobAIService: JobAIService;

    constructor() {
        this.jobService = new JobService();
        this.jobAIService = new JobAIService();
    }

    async createJob(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            const { description } = req.body;
            if (typeof description !== "string" || !description.trim()) {
                return res.status(400).json({ error: "Job description is required" });
            }
            const structuredJob = await this.jobAIService.generateStructuredJob(description.trim());

            if (!structuredJob) {
                return res.status(400).json({ error: "Failed to parse job description" });
            }

            // Attach recruiterId
            structuredJob.recruiterId = userId;

            const result = await this.jobService.createJob(structuredJob);
            res.status(201).json(result);
        } catch (error: any) {
            logger.error("CREATE_JOB_ERROR", error);
            res.status(500).json({ error: "Failed to create job" });
        }
    }

    async getAllJobs(req: Request, res: Response) {
        try {
            // Default to public view which omits sensitive fields
            const result = await this.jobService.getAllJobs(true);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("GET_ALL_JOBS_ERROR", error);
            res.status(500).json({ error: "Failed to fetch jobs" });
        }
    }

    async getJobById(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            // Public view omits sensitive fields
            const result = await this.jobService.getJobById(id, true);
            if (!result.data) {
                return res.status(404).json({ error: "Job not found" });
            }
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("GET_JOB_BY_ID_ERROR", error);
            res.status(500).json({ error: "Failed to fetch job" });
        }
    }

    async getRecruiterJobById(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const recruiterId = (req as any).user?._id;

            // Recruiter view includes ALL fields, but ONLY if they own the job (Zero Trust)
            const result = await this.jobService.getJobById(id, false, recruiterId);
            
            if (!result.data) {
                return res.status(403).json({ 
                    error: "Forbidden: Job not found or you do not have permission to view full details" 
                });
            }
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("GET_RECRUITER_JOB_BY_ID_ERROR", error);
            res.status(500).json({ error: "Failed to fetch job details" });
        }
    }

    async getRecruiterJobs(req: Request, res: Response) {
        try {
            const recruiterId = (req as any).user?._id;
            const result = await this.jobService.getJobsByRecruiter(recruiterId);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("GET_RECRUITER_JOBS_ERROR", error);
            res.status(500).json({ error: "Failed to fetch your jobs" });
        }
    }

    async patchJob(req: Request, res: Response) {
        try {
            const recruiterId = (req as any).user?._id;
            const { id } = req.params;
            const result = await this.jobService.patchJob(id, recruiterId, req.body);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("PATCH_JOB_ERROR", error);
            const status = error.message.includes("not found") || error.message.includes("own") ? 403 : 400;
            res.status(status).json({ success: false, message: error.message });
        }
    }

    async publishJob(req: Request, res: Response) {
        try {
            const recruiterId = (req as any).user?._id;
            const { id } = req.params;
            const result = await this.jobService.publishJob(id, recruiterId);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("PUBLISH_JOB_ERROR", error);
            const status = error.message.includes("not found") || error.message.includes("own") ? 403 : 400;
            res.status(status).json({ success: false, message: error.message });
        }
    }
}

export default JobController;