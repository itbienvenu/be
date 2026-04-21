import { JobService } from "./job.service.js";
import { JobAIService } from "../ai/ai.service.js";
import { type Request, type Response } from "express";
import logger from "@/shared/utils/logger.js";
import { validateJob } from "@/shared/utils/validator.js";
import type { JobJSON } from "./job.types.js";


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
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized: Missing user ID" });
            }
            const { description } = req.body;
            if (typeof description !== "string" || !description.trim()) {
                return res.status(400).json({ success: false, message: "Job description is required" });
            }
            const structuredJob = await this.jobAIService.generateStructuredJob(description.trim());

            if (!structuredJob) {
                return res.status(400).json({ success: false, message: "Failed to parse job description" });
            }

            // Attach recruiterId
            structuredJob.recruiterId = userId;

            const result = await this.jobService.createJob(structuredJob);
            res.status(201).json(result);
        } catch (error: any) {
            logger.error("CREATE_JOB_ERROR", error);
            res.status(500).json({ success: false, message: "Failed to create job" });
        }
    }

    /**
     * Create a job with manually entered details (Hackathon Manual Entry)
     * 
     * Validates all required fields against the Job schema and returns validation
     * errors as an array for frontend error handling.
     * 
     * @async
     * @param {Request} req - Express request object
     * @param {Response} res - Express response object
     * @returns {void} JSON response with success status and job data or validation errors
     * 
     * @example
     * POST /jobs/manual-entry
     * {
     *   "title": "Senior React Developer",
     *   "company": { "name": "TechCorp", "location": { "city": "Kigali", "country": "Rwanda" } },
     *   "employment_type": "full_time",
     *   "seniority_level": "senior",
     *   "description": { "raw": "...", "summary": "..." },
     *   "requirements": { "experience": { "min_years": 3 }, "education": [...] },
     *   "skills": [...],
     *   "domain": { "primary": "Technology" },
     *   "scoring_config": { "weights": {...}, "rules": {...} }
     * }
     */
    async createJobManually(req: Request, res: Response) {
        try {
            const userId = (req as any).user?._id;
            if (!userId) {
                return res.status(401).json({ 
                    success: false, 
                    message: "Unauthorized: Missing user ID" 
                });
            }

            const jobData: JobJSON = req.body;

            // Validate against job schema
            const { isValid, errors } = validateJob(jobData);

            if (!isValid || errors) {
                // Format validation errors as detailed array
                const formattedErrors = (errors || []).map((error: any) => ({
                    field: error.instancePath || "root",
                    message: error.message,
                    keyword: error.keyword,
                    schemaPath: error.schemaPath
                }));

                return res.status(422).json({
                    success: false,
                    message: "Validation failed. Please check the errors below.",
                    errors: formattedErrors
                });
            }

            // Attach recruiterId
            const jobToCreate = {
                ...jobData,
                recruiterId: userId,
                metadata: {
                    ...jobData.metadata,
                    status: "draft"  // Always start as draft
                }
            };

            const result = await this.jobService.createJob(jobToCreate);
            
            res.status(201).json({
                success: true,
                message: "Job created successfully in draft status",
                data: result.data
            });
        } catch (error: any) {
            logger.error("CREATE_JOB_MANUALLY_ERROR", error);
            res.status(500).json({ 
                success: false, 
                message: error.message || "Failed to create job" 
            });
        }
    }

    async getAllJobs(req: Request, res: Response) {
        try {
            // Default to public view which omits sensitive fields
            const result = await this.jobService.getAllJobs(true);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("GET_ALL_JOBS_ERROR", error);
            res.status(500).json({ success: false, message: "Failed to fetch jobs" });
        }
    }

    async getJobById(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            // Public view omits sensitive fields
            const result = await this.jobService.getJobById(id, true);
            if (!result.data) {
                return res.status(404).json({ success: false, message: "Job not found" });
            }
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("GET_JOB_BY_ID_ERROR", error);
            res.status(500).json({ success: false, message: "Failed to fetch job" });
        }
    }

    async getRecruiterJobById(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const recruiterId = (req as any).user?._id;
            if (!recruiterId) {
                return res.status(401).json({ success: false, message: "Unauthorized: Missing recruiter ID" });
            }

            // Recruiter view includes ALL fields, but ONLY if they own the job (Zero Trust)
            const result = await this.jobService.getJobById(id, false, recruiterId);
            
            if (!result.data) {
                return res.status(403).json({ 
                    success: false,
                    message: "Forbidden: Job not found or you do not have permission to view full details" 
                });
            }
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("GET_RECRUITER_JOB_BY_ID_ERROR", error);
            res.status(500).json({ success: false, message: "Failed to fetch job details" });
        }
    }

    async getRecruiterJobs(req: Request, res: Response) {
        try {
            const recruiterId = (req as any).user?._id;
            if (!recruiterId) {
                return res.status(401).json({ success: false, message: "Unauthorized: Missing recruiter ID" });
            }
            const result = await this.jobService.getJobsByRecruiter(recruiterId);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("GET_RECRUITER_JOBS_ERROR", error);
            res.status(500).json({ success: false, message: "Failed to fetch your jobs" });
        }
    }

    async patchJob(req: Request, res: Response) {
        try {
            const recruiterId = (req as any).user?._id;
            if (!recruiterId) {
                return res.status(401).json({ success: false, message: "Unauthorized: Missing recruiter ID" });
            }
            const id = req.params.id as string;
            const result = await this.jobService.patchJob(id, recruiterId, req.body);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("PATCH_JOB_ERROR", error);
            const status = error.statusCode ?? 400;
            res.status(status).json({ success: false, message: error.message });
        }
    }

    async publishJob(req: Request, res: Response) {
        try {
            const recruiterId = (req as any).user?._id;
            if (!recruiterId) {
                return res.status(401).json({ success: false, message: "Unauthorized: Missing recruiter ID" });
            }
            const id = req.params.id as string;
            const result = await this.jobService.publishJob(id, recruiterId);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("PUBLISH_JOB_ERROR", error);
            const status = error.statusCode ?? 400;
            res.status(status).json({ success: false, message: error.message });
        }
    }

    async unpublishJob(req: Request, res: Response) {
        try {
            const recruiterId = (req as any).user?._id;
            if (!recruiterId) {
                return res.status(401).json({ success: false, message: "Unauthorized: Missing recruiter ID" });
            }
            const id = req.params.id as string;
            const result = await this.jobService.unpublishJob(id, recruiterId);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("UNPUBLISH_JOB_ERROR", error);
            const status = error.statusCode ?? 400;
            res.status(status).json({ success: false, message: error.message });
        }
    }

    async archiveJob(req: Request, res: Response) {
        try {
            const recruiterId = (req as any).user?._id;
            if (!recruiterId) {
                return res.status(401).json({ success: false, message: "Unauthorized: Missing recruiter ID" });
            }
            const id = req.params.id as string;
            const result = await this.jobService.archiveJob(id, recruiterId);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("ARCHIVE_JOB_ERROR", error);
            const status = error.statusCode ?? 400;
            res.status(status).json({ success: false, message: error.message });
        }
    }

    async unarchiveJob(req: Request, res: Response) {
        try {
            const recruiterId = (req as any).user?._id;
            if (!recruiterId) {
                return res.status(401).json({ success: false, message: "Unauthorized: Missing recruiter ID" });
            }
            const id = req.params.id as string;
            const result = await this.jobService.unarchiveJob(id, recruiterId);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("UNARCHIVE_JOB_ERROR", error);
            const status = error.statusCode ?? 400;
            res.status(status).json({ success: false, message: error.message });
        }
    }
}

export default JobController;