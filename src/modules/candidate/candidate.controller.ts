import { CandidateService } from "./candidate.service.js";
import { type Request, type Response } from "express";
import { ValidationError } from "@/shared/utils/custom-errors.js";

export class CandidateController {
    private candidateService: CandidateService;

    constructor() {
        this.candidateService = new CandidateService();
    }

    async register(req: Request, res: Response) {
        try {
            const { fullName, email, phoneNumber } = req.body as { fullName: string; email: string; phoneNumber?: string };
            const file = req.file;

            if (!fullName || !email) {
                throw new ValidationError("Full name and email are required");
            }

            if (!file) {
                throw new ValidationError("CV file is required");
            }

            const candidate = await this.candidateService.registerCandidate(
                { fullName, email, phoneNumber },
                file.buffer
            );

            res.status(201).json({
                success: true,
                message: "Candidate registered successfully",
                data: candidate
            });
        } catch (error: any) {
            const statusCode = error.statusCode || 500;
            res.status(statusCode).json({
                success: false,
                message: error.message || "Internal server error"
            });
        }
    }
}
