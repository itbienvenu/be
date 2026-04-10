import { Router } from "express";
import { RecruiterController } from "./recruiter.controller.js";
import { AuthMiddleware } from "@/middlewares/auth.middleware.js";

export class RecruiterRoutes {
    public router: Router;
    private recruiterController: RecruiterController;
    private authMiddleware: AuthMiddleware;

    constructor() {
        this.router = Router();
        this.recruiterController = new RecruiterController();
        this.authMiddleware = new AuthMiddleware();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // Create or Update recruiter company profile
        this.router.post(
            "/profile",
            this.authMiddleware.authenticate,
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.recruiterController.updateProfile(req, res)
        );

        // Get personal recruiter company profile
        this.router.get(
            "/profile",
            this.authMiddleware.requireRole("recruiter"),
            (req, res) => this.recruiterController.getProfile(req, res)
        );
    }
}

export default RecruiterRoutes;
