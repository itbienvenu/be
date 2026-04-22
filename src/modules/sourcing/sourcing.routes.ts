
import { Router } from "express";
import { SourcingController } from "./sourcing.controller.js";
import { AuthMiddleware } from "@/middlewares/auth.middleware.js";
import multer from "multer";

const roleMiddleware = new AuthMiddleware();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for spreadsheets
});

/**
 * SourcingRoutes
 * 
 * Exposes recruiter-specific candidate sourcing and bulk management endpoints.
 */
export class SourcingRoutes {
    public router: Router;
    private controller = new SourcingController();

    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        /**
         * POST /api/v1/sourcing/bulk-import
         * Triggered by recruiters to import batches of candidates for a job.
         */
        this.router.post(
            "/bulk-import",
            roleMiddleware.requireRole("recruiter"),
            upload.single("file"),
            (req, res) => this.controller.bulkImport(req, res)
        );

        /**
         * GET /api/v1/sourcing/template
         * Provides a CSV template for bulk imports.
         */
        this.router.get(
            "/template",
            roleMiddleware.requireRole("recruiter"),
            (req, res) => this.controller.getTemplate(req, res)
        );
    }
}

export default SourcingRoutes;
