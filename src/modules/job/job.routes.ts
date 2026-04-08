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
        this.router.post("/", this.authMiddleware.requireRole("recruiter"), (req, res) => this.jobController.createJob(req, res));
    }
}

export default JobRoutes;