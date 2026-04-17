import { Router } from "express";
import { ScreeningController } from "./screening.controller.js";
import { AuthMiddleware } from "@/middlewares/auth.middleware.js";

const roleMiddleware = new AuthMiddleware();

export class ScreeningRoutes {
    public router: Router;
    private controller = new ScreeningController();

    constructor() {
        this.router = Router({ mergeParams: true }); // mergeParams to access :jobId from parent router
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // POST /jobs/:jobId/screen — recruiter triggers AI screening
        this.router.post(
            "/screen",
            roleMiddleware.requireRole("recruiter"),
            (req, res) => this.controller.triggerScreening(req, res)
        );

        // GET /jobs/:jobId/shortlist?limit=10|20 — recruiter retrieves ranked shortlist
        this.router.get(
            "/shortlist",
            roleMiddleware.requireRole("recruiter"),
            (req, res) => this.controller.getShortlist(req, res)
        );
    }
}

export default ScreeningRoutes;
