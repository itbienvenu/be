
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { SourcingController } from "./sourcing.controller.js";
import { authMiddleware } from "@/shared/middleware/auth.middleware.js";
import multer from "multer";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

function handleUploadErrors(req: Request, res: Response, next: NextFunction) {
    upload.single("file")(req, res, (err: any) => {
        if (err) {
            return res.status(400).json({ success: false, message: `File upload failed: ${err.message}` });
        }
        next();
    });
}

export class SourcingRoutes {
    public router: Router;
    private controller = new SourcingController();

    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post(
            "/bulk-import",
            authMiddleware,
            handleUploadErrors,
            (req, res) => this.controller.bulkImport(req, res)
        );

        this.router.get(
            "/template",
            authMiddleware,
            (req, res) => this.controller.getTemplate(req, res)
        );
    }
}

export default SourcingRoutes;
