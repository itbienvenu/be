import { Router } from "express";
import { ApplicationController } from "./application.controller.js";
import { AuthMiddleware } from "@/middlewares/auth.middleware.js";

const roleMiddleware = new AuthMiddleware();

export class ApplicationRoutes {
    public router: Router;
    private controller = new ApplicationController();

    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // Static routes first to avoid being shadowed by dynamic params

        // Applicant: view their own applications
        this.router.get(
            "/my",
            roleMiddleware.requireRole("applicant"),
            (req, res) => this.controller.getMyApplications(req, res)
        );

        // Recruiter: view all applications for a specific job
        this.router.get(
            "/job/:jobId",
            roleMiddleware.requireRole("recruiter"),
            (req, res) => this.controller.getJobApplications(req, res)
        );

        // Recruiter: update application status
        this.router.patch(
            "/:applicationId/status",
            roleMiddleware.requireRole("recruiter"),
            (req, res) => this.controller.updateStatus(req, res)
        );

        // Applicant or Recruiter: view a single application by ID
        this.router.get(
            "/:applicationId",
            roleMiddleware.authenticate,
            (req, res) => this.controller.getById(req, res)
        );

        // Applicant: submit application to a job (dynamic param last)
        this.router.post(
            "/:jobId",
            roleMiddleware.requireRole("applicant"),
            (req, res) => this.controller.apply(req, res)
        );
    }
}

export default ApplicationRoutes;
