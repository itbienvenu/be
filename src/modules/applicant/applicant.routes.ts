import { Router } from "express";
import { ApplicantController } from "./applicant.controller.js";
import { authMiddleware } from "@/shared/middleware/auth.middleware.js";
import { aiGenerationRateLimiter } from "@/shared/middleware/rate-limit.middleware.js";
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
        // Step 1: Upload CV and get extracted JSON for review
        // Rate limited to 5 requests per minute due to AI parsing cost
        this.router.post(
            "/upload-cv",
            authMiddleware,
            aiGenerationRateLimiter,
            upload.single("cv"),
            (req, res) => this.applicantController.uploadCV(req, res)
        );

        // Step 2: Save the reviewed JSON profile
        this.router.post(
            "/save-profile",
            authMiddleware,
            (req, res) => this.applicantController.saveProfile(req, res)
        );

        // Get personal applicant profile
        this.router.get(
            "/profile",
            authMiddleware,
            (req, res) => this.applicantController.getProfile(req, res)
        );

        // Partially update profile fields
        this.router.patch(
            "/profile",
            authMiddleware,
            (req, res) => this.applicantController.patchProfile(req, res)
        );

        // AI-Powered Cover Letter Generation
        // Rate limited to 5 requests per minute due to AI generation cost
        this.router.post(
            "/generate-cover-letter/:jobId",
            authMiddleware,
            aiGenerationRateLimiter,
            upload.single("cvFile"),
            (req, res) => this.applicantController.generateCoverLetter(req, res)
        );

        // Get applicant analytics
        this.router.get(
            "/analytics",
            authMiddleware,
            (req, res) => this.applicantController.getAnalytics(req, res)
        );
    }
}

export default ApplicantRoutes;
