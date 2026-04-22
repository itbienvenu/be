import JobController from "./job.controller.js";
import { Router } from "express";
import { AuthMiddleware } from "@/middlewares/auth.middleware.js";
import { jobCreationRateLimiter, aiGenerationRateLimiter } from "@/shared/middleware/rate-limit.middleware.js";

export class JobRoutes {
    public router: Router;
    private jobController: JobController;
    private authMiddleware: AuthMiddleware;

    constructor() {
        this.router = Router();
        this.jobController = new JobController();
        this.authMiddleware = new AuthMiddleware();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // Public route to get all jobs (omits sensitive scoring data)
        this.router.get("/", (req, res) => this.jobController.getAllJobs(req, res));

        // Recruiter route to get all their posted jobs (Aliases: /my-jobs, /recruiter)
        this.router.get(
            "/my-jobs",
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.jobController.getRecruiterJobs(req, res)
        );

        this.router.get(
            "/recruiter",
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.jobController.getRecruiterJobs(req, res)
        );

        // Recruiter route to get full job details with scoring info (Zero Trust Ownership)
        this.router.get(
            "/recruiter/:id",
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.jobController.getRecruiterJobById(req, res)
        );

        // Protected route for recruiters to post jobs
        this.router.post("/", this.authMiddleware.requireRole("recruiter"), (req, res) => this.jobController.createJob(req, res));

        // Protected route for manual job entry (Hackathon Feature)
        // Rate limited to 10 requests per minute to prevent spam
        this.router.post(
            "/manual-entry",
            this.authMiddleware.requireRole("recruiter"),
            jobCreationRateLimiter,
            (req, res) => this.jobController.createJobManually(req, res)
        );

        // AI Route: Generate a professional job description from a simple draft
        // Stricter rate limit (5/min) because AI calls are expensive
        this.router.post(
            "/generate-description",
            this.authMiddleware.requireRole("recruiter"),
            aiGenerationRateLimiter,
            (req, res) => this.jobController.generateJobDescription(req, res)
        );

        // Recruiter: patch (edit) a draft job
        this.router.patch(
            "/:id",
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.jobController.patchJob(req, res)
        );

        // Recruiter: publish a job
        this.router.patch(
            "/:id/publish",
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.jobController.publishJob(req, res)
        );

        // Recruiter: unpublish a job (published → draft)
        this.router.patch(
            "/:id/unpublish",
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.jobController.unpublishJob(req, res)
        );

        // Recruiter: archive a job (draft or published → archived)
        this.router.patch(
            "/:id/archive",
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.jobController.archiveJob(req, res)
        );

        // Recruiter: unarchive a job (archived → draft)
        this.router.patch(
            "/:id/unarchive",
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.jobController.unarchiveJob(req, res)
        );

        // Recruiter: delete a job (allowed for draft jobs)
        this.router.delete(
            "/:id",
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.jobController.deleteJob(req, res)
        );

        // Public route to get a single job by ID (moved to bottom to avoid shadowing)
        this.router.get("/:id", (req, res) => this.jobController.getJobById(req, res));
    }
}

export default JobRoutes;