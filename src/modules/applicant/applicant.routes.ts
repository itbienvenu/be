import { Router } from "express";
import { ApplicantController } from "./applicant.controller.js";
import { authMiddleware } from "@/shared/middleware/auth.middleware.js";
import multer from "multer";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed"));
        }
    }
});

export class ApplicantRoutes {
    public router: Router;
    private applicantController: ApplicantController;

    constructor() {
        this.router = Router();
        this.applicantController = new ApplicantController();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // Upload CV and parse it
        this.router.post(
            "/upload-cv",
            authMiddleware,
            upload.single("cv"),
            (req, res) => this.applicantController.uploadCV(req, res)
        );

        // Get personal applicant profile
        this.router.get(
            "/profile",
            authMiddleware,
            (req, res) => this.applicantController.getProfile(req, res)
        );
    }
}

export default ApplicantRoutes;
