import { ApplicantRepository } from "./applicant.repository.js";
import { CVParserService } from "@/modules/ai/ai.service.js";
import { PDFTool } from "@/shared/utils/pdfs-tool.js";
import { CloudinaryTool } from "@/shared/utils/cloudinary-tool.js";
import type { ApplicantJSON, ApplicantProfileJSON } from "./applicant.types.js";

export class ApplicantService {
    private applicantRepo: ApplicantRepository;
    private cvParser: CVParserService;
    private pdfTool: PDFTool;
    private cloudinary: CloudinaryTool;

    constructor() {
        this.applicantRepo = new ApplicantRepository();
        this.cvParser = new CVParserService();
        this.pdfTool = new PDFTool();
        this.cloudinary = new CloudinaryTool();
    }

    /**
     * Step 1: Upload CV and extract data (Returns data for user review)
     */
    async uploadAndProcessCV(userId: string, fileBuffer: Buffer): Promise<{ profile: ApplicantProfileJSON; cvUrl: string; cvPublicId: string } | null> {
        try {
            // 1. Upload CV to Cloudinary
            const uploadResult = await this.cloudinary.uploadFile(fileBuffer, "applicant_cvs");

            // 2. Extract text from PDF
            const rawText = await this.pdfTool.readPdfFromBuffer(fileBuffer);

            // 3. Parse with AI to get structured data
            const parsedProfile: ApplicantProfileJSON | null = await this.cvParser.parseCV(rawText);

            if (!parsedProfile) {
                throw new Error("Failed to extract structured data from CV");
            }

            // Return the data to the frontend for review
            return {
                profile: parsedProfile,
                cvUrl: uploadResult.url,
                cvPublicId: uploadResult.public_id
            };
        } catch (error: any) {
            console.error("ApplicantService Error:", error.message);
            throw error;
        }
    }

    /**
     * Step 2: Finalize and save the applicant profile (After user review)
     */
    async updateProfile(userId: string, data: Omit<ApplicantJSON, "_id" | "userId">): Promise<ApplicantJSON | null> {
        const success = await this.applicantRepo.upsertByUserId(userId, data);
        if (success) {
            return await this.applicantRepo.findByUserId(userId);
        }
        return null;
    }

    /**
     * Get applicant profile by userId
     */
    async getProfile(userId: string): Promise<ApplicantJSON | null> {
        return this.applicantRepo.findByUserId(userId);
    }
}
