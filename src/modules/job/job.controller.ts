import { JobService } from "./job.service.js";
import { JobAIService } from "../ai/ai.service.js";
import { type Request, type Response } from "express";
import logger from "@/shared/utils/logger.js";
import { validateJob } from "@/shared/utils/validator.js";
import type { JobJSON, JobStatus } from "./job.types.js";


export class JobController {
    private jobService: JobService;
    private jobAIService: JobAIService;

    constructor() {
        this.jobService = new JobService();
        this.jobAIService = new JobAIService();
    }

    private getPagination(req: Request): { page: number, limit: number } {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        if (isNaN(page) || page < 1) {
            const error: any = new Error("Page number must be a positive integer >= 1");
            error.statusCode = 400;
            throw error;
        }

        if (isNaN(limit) || limit < 1 || limit > 100) {
            const error: any = new Error("Limit must be a positive integer between 1 and 100");
            error.statusCode = 400;
            throw error;
        }

        return { page, limit };
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
     * Accepts structured job data from the frontend form and validates it against the Job schema.
     * Automatically populates metadata (created_at, updated_at, status, source) with defaults.
     * Validation errors are returned as a detailed array for precise frontend error handling.
     * 
     * **Process:**
     * 1. Extract and validate user ID
     * 2. Enrich job data with default metadata and recruiterId
     * 3. Validate complete job object against schema
     * 4. If valid, persist to database in draft status
     * 5. If invalid, return detailed validation errors with field paths
     * 
     * @async
     * @param {Request} req - Express request object containing job data in body
     * @param {Response} res - Express response object
     * @returns {void} JSON response with success status, created job data, or validation errors array
     * 
     * @example
     * POST /jobs/manual-entry
     * {
     *   "title": "Senior React Developer",
     *   "company": { "name": "TechCorp", "location": { "city": "Kigali", "country": "Rwanda" } },
     *   "employment_type": "full_time",
     *   "seniority_level": "senior",
     *   "description": { "raw": "Build web apps...", "summary": "Frontend development" },
     *   "requirements": { "experience": { "min_years": 3 }, "education": [...] },
     *   "skills": [...],
     *   "domain": { "primary": "Technology" },
     *   "scoring_config": { "weights": {...}, "rules": {...} }
     * }
     * 
     * @response 201 - Job created successfully with default metadata and draft status
     * @response 422 - Validation failed with detailed error array
     * @response 401 - Unauthorized (missing user ID / recruiter role)
     * @response 500 - Server error
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

            const now = new Date().toISOString();
            const jobData: JobJSON = req.body;

            // Destructure to exclude any metadata from the input (if provided)
            // We always generate fresh metadata server-side for security and consistency
            const { metadata: _ignoredMetadata, recruiterId: _ignoredRecruiter, ...safeJobData } = jobData;

            // Enrich job data with recruiter ID and complete metadata BEFORE validation
            // This ensures the full object matches the schema requirements
            const enrichedJobData = {
                ...safeJobData,
                recruiterId: userId,
                metadata: {
                    created_at: now,
                    updated_at: now,
                    status: "draft" as JobStatus,  // Always start as draft
                    source: "manual_entry"  // Identifies this as manually entered
                }
            };

            // Validate enriched job data against job schema
            const { isValid, errors } = validateJob(enrichedJobData);

            if (!isValid || errors) {
                // Format validation errors as detailed array for frontend processing
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

            // Persist validated job to database
            const result = await this.jobService.createJob(enrichedJobData);
            
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
            const { page, limit } = this.getPagination(req);

            // Default to public view which omits sensitive fields
            const result = await this.jobService.getAllJobs(true, page, limit);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("GET_ALL_JOBS_ERROR", error);
            const status = error.statusCode || 500;
            res.status(status).json({ success: false, message: error.message || "Failed to fetch jobs" });
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
            const { page, limit } = this.getPagination(req);

            const result = await this.jobService.getJobsByRecruiter(recruiterId, page, limit);
            res.status(200).json(result);
        } catch (error: any) {
            logger.error("GET_RECRUITER_JOBS_ERROR", error);
            const status = error.statusCode || 500;
            res.status(status).json({ success: false, message: error.message || "Failed to fetch your jobs" });
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

    async deleteJob(req: Request, res: Response) {
        try {
            const recruiterId = (req as any).user?._id;
            if (!recruiterId) {
                return res.status(401).json({ success: false, message: "Unauthorized: Missing recruiter ID" });
            }
            const id = req.params.id as string;
            await this.jobService.deleteJob(id, recruiterId);
            res.status(204).send(); // No content on successful deletion
        } catch (error: any) {
            logger.error("DELETE_JOB_ERROR", error);
            const status = error.statusCode ?? 400;
            res.status(status).json({ success: false, message: error.message });
        }
    }
}

export default JobController;