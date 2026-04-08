import { CandidateRepository } from "./candidate.repository.js";
import { PDFTool } from "@/shared/utils/pdfs-tool.js";
import { type CreateCandidateDTO, type Candidate } from "./candidate.types.js";
import { ServiceError, ConflictError } from "@/shared/utils/custom-errors.js";

export class CandidateService {
    private candidateRepository: CandidateRepository;
    private pdfTool: PDFTool;

    constructor() {
        this.candidateRepository = new CandidateRepository();
        this.pdfTool = new PDFTool();
    }

    async registerCandidate(dto: CreateCandidateDTO, fileBuffer: Buffer): Promise<Candidate> {
        // 1. Check if candidate already exists
        const existing = await this.candidateRepository.findByEmail(dto.email);
        if (existing) {
            throw new ConflictError("Candidate with this email already exists");
        }

        // 2. Upload CV to Cloudinary
        const uploadResult = await this.pdfTool.uploadToCloudinary(fileBuffer);

        try {
            // 3. Extract text from PDF
            const cvText = await this.pdfTool.readPdfFromBuffer(fileBuffer);

            // 4. Save to database
            const candidateData: Candidate = {
                ...dto,
                cvUrl: uploadResult.url,
                cvPublicId: uploadResult.publicId,
                cvText,
            };

            return await this.candidateRepository.create(candidateData);
        } catch (error: any) {
            // Rollback: delete from Cloudinary if DB save fails or parsing fails
            await this.pdfTool.deleteFromCloudinary(uploadResult.publicId);
            throw new ServiceError(`Failed to process candidate registration: ${error.message}`);
        }
    }
}
