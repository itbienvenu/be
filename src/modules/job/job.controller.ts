import { JobService } from "./job.service.js";
import type { JobJSON } from "./job.types.js";
import JobAIService from "../ai/ai.service.js";
import { type Request, type Response } from "express";


export class JobController {
    private jobService: JobService;
    private jobAIService: JobAIService;

    constructor() {
        this.jobService = new JobService();
        this.jobAIService = new JobAIService();
    }

    async createJob(req: Request, res: Response) {
        try {
            const { description } = req.body;
            if (!description) {
                return res.status(400).json({ error: "Job description is required" });
            }
            const structuredJob = await this.jobAIService.generateStructuredJob(req.body.description);

            if (!structuredJob) {
                return res.status(400).json({ error: "Failed to parse job description" });
            }
            const result = await this.jobService.createJob(structuredJob);
            res.status(201).json(result);
        } catch (error) {
            res.status(500).json({ error: "Failed to create job" });
        }
    }
}

export default JobController;