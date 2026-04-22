import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { SourcingController } from "./sourcing.controller.js";
import { AuthMiddleware } from "@/middlewares/auth.middleware.js";
import multer from "multer";

const roleMiddleware = new AuthMiddleware();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            "text/csv",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ];
        const extension = file.originalname.split(".").pop()?.toLowerCase();
        const allowedExtensions = ["csv", "xlsx", "xls"];

        if (allowedMimes.includes(file.mimetype) || (extension && allowedExtensions.includes(extension))) {
            cb(null, true);
        } else {
            cb(new Error("Unsupported file type. Please upload a CSV or Excel file (.xlsx, .xls)"));
        }
    }
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
            roleMiddleware.requireRole("recruiter"),
            handleUploadErrors,
            (req, res) => this.controller.bulkImport(req, res)
        );

        this.router.get(
            "/template",
            roleMiddleware.requireRole("recruiter"),
            (req, res) => this.controller.getTemplate(req, res)
        );
    }
}

export default SourcingRoutes;
