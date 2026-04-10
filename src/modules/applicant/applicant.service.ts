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
     * Upload CV and extract data to create/update applicant profile
     */
    async uploadAndProcessCV(userId: string, fileBuffer: Buffer): Promise<ApplicantJSON | null> {
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

            // 4. Save to database
            const applicantData: Omit<ApplicantJSON, "_id" | "userId"> = {
                cvUrl: uploadResult.url,
                cvPublicId: uploadResult.public_id,
                profile: parsedProfile
            };

            const success = await this.applicantRepo.upsertByUserId(userId, applicantData);

            if (success) {
                return await this.applicantRepo.findByUserId(userId);
            }

            return null;
        } catch (error: any) {
            console.error("ApplicantService Error:", error.message);
            throw error;
        }
    }

    /**
     * Get applicant profile by userId
     */
    async getProfile(userId: string): Promise<ApplicantJSON | null> {
        return this.applicantRepo.findByUserId(userId);
    }
}
