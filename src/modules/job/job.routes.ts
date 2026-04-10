import JobController from "./job.controller.js";
import { Router } from "express";
import { AuthMiddleware } from "@/middlewares/auth.middleware.js";

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

        // Recruiter route to get all their posted jobs
        this.router.get(
            "/my-jobs",
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.jobController.getRecruiterJobs(req, res)
        );

        // Public route to get a single job by ID (omits sensitive scoring data)
        this.router.get("/:id", (req, res) => this.jobController.getJobById(req, res));

        // Recruiter route to get full job details with scoring info (Zero Trust Ownership)
        this.router.get(
            "/recruiter/:id",
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.jobController.getRecruiterJobById(req, res)
        );

        // Protected route for recruiters to post jobs
        this.router.post("/", this.authMiddleware.requireRole("recruiter"), (req, res) => this.jobController.createJob(req, res));
    }
}

export default JobRoutes;