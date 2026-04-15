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
        // Step 1: Upload CV and get extracted JSON for review
        this.router.post(
            "/upload-cv",
            authMiddleware,
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
    }
}

export default ApplicantRoutes;
