import { Router } from "express";
import { CandidateController } from "./candidate.controller.js";
import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed"));
        }
    }
});

export class CandidateRoutes {
    public router: Router;
    private candidateController: CandidateController;

    constructor() {
        this.router = Router();
        this.candidateController = new CandidateController();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post("/register", upload.single("cv"), (req, res) => 
            this.candidateController.register(req, res)
        );
    }
}

export default CandidateRoutes;
