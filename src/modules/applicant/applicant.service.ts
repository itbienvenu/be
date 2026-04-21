import { ApplicantRepository } from "./applicant.repository.js";
import { CVParserService } from "@/modules/ai/ai.service.js";
import { PDFTool } from "@/shared/utils/pdfs-tool.js";
import { CloudinaryTool } from "@/shared/utils/cloudinary-tool.js";
import logger from "@/shared/utils/logger.js";
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
    async uploadAndProcessCV(userId: string, fileBuffer: Buffer): Promise<{ profile: ApplicantProfileJSON; cvUrl: string; cvPublicId: string; cvRawText: string } | null> {
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

            const cvData = {
                cvUrl: uploadResult.url,
                cvPublicId: uploadResult.public_id,
                cvRawText: rawText,
            };

            // AUTO-SAVE: Persist CV info immediately so it's not lost if user doesn't confirm profile save
            // We use upsertByUserId to handle both new and existing profiles
            await this.applicantRepo.upsertByUserId(userId, cvData as any);

            return {
                profile: parsedProfile,
                ...cvData
            };
        } catch (error: any) {
            console.error("ApplicantService Error:", error.message);
            throw error;
        }
    }

    /**
     * Step 2: Finalize and save the applicant profile (After user review)
     * Handles both nested { profile: { ... } } and flat { first_name: ... } payloads.
     */
    async updateProfile(userId: string, data: any): Promise<ApplicantJSON | null> {
        logger.info(`ApplicantService: Restructuring input payload for user ${userId.substring(0, 5)}...`);
        const structured: any = {
            profile: data.profile || {}
        };

        // 1. Move root-level CV fields
        if (data.cvUrl) structured.cvUrl = data.cvUrl;
        if (data.cvPublicId) structured.cvPublicId = data.cvPublicId;
        if (data.cvRawText) structured.cvRawText = data.cvRawText;

        // 2. Identify profile-specific fields
        const profileFields = [
            "first_name", "last_name", "email", "headline", "bio", "location",
            "gender", "nationality", "date_of_birth", "profile_picture",
            "skills", "languages", "experience", "education",
            "certifications", "projects", "availability", "social_links",
            "preferences", "area_of_expertise"
        ];

        // 3. Collect flat profile fields from the root
        for (const field of profileFields) {
            if (data[field] !== undefined) {
                structured.profile[field] = data[field];
            }
        }

        logger.info(`ApplicantService: Executing upsertByUserId for ${userId.substring(0, 5)}...`);
        const success = await this.applicantRepo.upsertByUserId(userId, structured);
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
    async patchProfile(userId: string, partial: any): Promise<ApplicantJSON | null> {
        const existing = await this.applicantRepo.findByUserId(userId);
        if (!existing) throw new Error("Profile not found");

        const flatUpdate: Record<string, any> = {};

        // 1. Handle top-level fields
        if (partial.cvUrl !== undefined) flatUpdate["cvUrl"] = partial.cvUrl;
        if (partial.cvPublicId !== undefined) flatUpdate["cvPublicId"] = partial.cvPublicId;
        if (partial.cvRawText !== undefined) flatUpdate["cvRawText"] = partial.cvRawText;

        // 2. Handle profile fields (both nested and flat)
        const profileFields = [
            "first_name", "last_name", "email", "headline", "bio", "location",
            "gender", "nationality", "date_of_birth", "profile_picture",
            "skills", "languages", "experience", "education",
            "certifications", "projects", "availability", "social_links",
            "preferences", "area_of_expertise"
        ];

        // If the user sent a 'profile' object, process its keys
        if (partial.profile && typeof partial.profile === "object") {
            for (const [key, value] of Object.entries(partial.profile)) {
                if (value !== undefined) {
                    flatUpdate[`profile.${key}`] = value;
                }
            }
        }

        // Also check if any profile fields were sent at the top level (flat)
        // This makes the API more robust for different frontend implementations
        for (const field of profileFields) {
            if (partial[field] !== undefined) {
                flatUpdate[`profile.${field}`] = partial[field];
            }
        }

        if (Object.keys(flatUpdate).length === 0) {
            throw new Error("No valid fields provided for update");
        }

        const success = await this.applicantRepo.patchByUserId(userId, flatUpdate);
        if (success) {
            return await this.applicantRepo.findByUserId(userId);
        }
        return null;
    }
}
