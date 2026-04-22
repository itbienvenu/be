
import XLSX from "xlsx";
import { PDFTool } from "@/shared/utils/pdfs-tool.js";
import { CVParserService } from "@/modules/ai/ai.service.js";
import { ApplicantRepository } from "@/modules/applicant/applicant.repository.js";
import { ApplicationRepository } from "@/modules/application/application.repository.js";
import { JobRepository } from "@/modules/job/job.repository.js";
import logger from "@/shared/utils/logger.js";
import type { ApplicantProfileJSON } from "@/modules/applicant/applicant.types.js";
import type {
    SourcingBulkUploadRequest,
    SourcingBulkUploadResponse,
    RawCandidateRow,
    MappedCandidateData,
    CandidateProcessResult,
    ColumnMapping,
} from "./sourcing.types.js";

/**
 * Sourcing Service
 * 
 * Orchestrates recruiter-driven candidate sourcing flows:
 * - Bulk importing candidates from spreadsheets
 * - Linking them to specific jobs
 * - Using AI to normalize resume data
 */
export class SourcingService {
    private pdfTool: PDFTool;
    private cvParser: CVParserService;
    private applicantRepo: ApplicantRepository;
    private applicationRepo: ApplicationRepository;
    private jobRepo: JobRepository;

    constructor() {
        this.pdfTool = new PDFTool();
        this.cvParser = new CVParserService();
        this.applicantRepo = new ApplicantRepository();
        this.applicationRepo = new ApplicationRepository();
        this.jobRepo = new JobRepository();
    }

    async processBulkImport(req: SourcingBulkUploadRequest, recruiterId: string): Promise<SourcingBulkUploadResponse> {
        try {
            logger.info(`[Sourcing] Starting bulk import for job ${req.jobId} by recruiter ${recruiterId}`);

            const job = await this.jobRepo.getJobById(req.jobId, false, recruiterId);
            if (!job.data) {
                return {
                    success: false,
                    data: { imported: 0, failed: 0, total: 0, jobId: req.jobId, results: [] },
                    message: "Job not found or unauthorized",
                };
            }

            const rows = this.parseFile(req.file.buffer, req.file.originalname);
            const results: CandidateProcessResult[] = [];

            for (const row of rows) {
                logger.info(`[Sourcing] Processing row ${row.row_number}/${rows.length + 1}...`);
                const result = await this.processCandidateRow(row, req.columnMapping, req.jobId);
                results.push(result);

                if (!req.skipInvalidRows && !result.success) {
                    logger.warn(`[Sourcing] Aborting import due to failure at row ${row.row_number}: ${result.error?.message}`);
                    return {
                        success: false,
                        data: {
                            imported: results.filter(r => r.success).length,
                            failed: results.filter(r => !r.success).length,
                            total: rows.length,
                            jobId: req.jobId,
                            results,
                        },
                        message: `Import aborted at row ${row.row_number}: ${result.error?.message}`,
                    };
                }
            }

            const imported = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            logger.info(`[Sourcing] Bulk import finished: ${imported} imported, ${failed} failed.`);

            return {
                success: imported > 0 && failed === 0,
                data: { imported, failed, total: rows.length, jobId: req.jobId, results },
                message: "Bulk import completed",
            };
        } catch (error: any) {
            logger.error("[Sourcing] Fatal error during bulk import", error);
            return {
                success: false,
                data: { imported: 0, failed: 0, total: 0, jobId: req.jobId, results: [] },
                message: error.message || "Bulk import failed",
            };
        }
    }

    private parseFile(buffer: Buffer, filename: string): RawCandidateRow[] {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("File contains no sheets");
        
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error("Failed to read sheet");
        
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        return rows.map((data, index) => ({
            row_number: index + 2,
            data,
        }));
    }

    private async processCandidateRow(
        row: RawCandidateRow,
        mapping: ColumnMapping,
        jobId: string
    ): Promise<CandidateProcessResult> {
        const result: CandidateProcessResult = {
            row_number: row.row_number,
            first_name: "", last_name: "", email: "",
            success: false,
        };

        try {
            const mapped = this.mapRow(row.data, mapping);
            Object.assign(result, { first_name: mapped.first_name, last_name: mapped.last_name, email: mapped.email });

            if (!mapped.email) throw new Error("Email is required");

            // 1. Check for existing applicant or create new one
            let applicantId: string;
            const existingApplicant = await this.applicantRepo.findByUserId(mapped.email);

            let resumeText = "";
            if (mapped.resume_url) {
                resumeText = await this.fetchResumeText(mapped.resume_url);
            }

            const parsedProfile = resumeText ? await this.cvParser.parseCV(resumeText) : null;
            const finalProfile = this.assembleProfile(mapped, parsedProfile);

            if (existingApplicant) {
                applicantId = existingApplicant._id.toString();
                // Update profile with new information from AI/Spreadsheet
                await this.applicantRepo.patchByUserId(mapped.email, {
                    profile: finalProfile,
                    cvRawText: resumeText || existingApplicant.cvRawText,
                    cvUrl: mapped.resume_url || existingApplicant.cvUrl
                });
            } else {
                const applicant = await this.applicantRepo.createImported({
                    userId: mapped.email,
                    cvUrl: mapped.resume_url || "",
                    cvPublicId: `src-${Date.now()}-${row.row_number}`,
                    cvRawText: resumeText,
                    profile: finalProfile
                });
                applicantId = applicant._id!;
            }

            result.applicantId = applicantId;

            // 2. Check for existing application for this job
            const existingApp = await this.applicationRepo.findByApplicantAndJob(applicantId, jobId);
            if (existingApp) {
                result.applicationId = existingApp._id!.toString();
                result.success = true;
                return result;
            }

            // 3. Create Application
            const application = await this.applicationRepo.create({
                applicantId: applicantId,
                jobId,
                cvUrl: mapped.resume_url || "",
                cvRawText: resumeText,
                status: "pending",
                appliedAt: new Date(),
            });

            if (application?._id) {
                result.applicationId = application._id.toString();
                result.success = true;
            }
        } catch (error: any) {
            result.error = { stage: "save", message: error.message };
        }

        return result;
    }

    private mapRow(data: Record<string, any>, mapping: ColumnMapping): MappedCandidateData {
        const get = (f: keyof ColumnMapping) => (mapping[f] ? (data[mapping[f]!] || "").toString().trim() : "");
        return {
            row_number: 0,
            first_name: get("first_name"),
            last_name: get("last_name"),
            email: get("email"),
            resume_url: get("resume_url"),
            headline: get("headline"),
            bio: get("bio"),
            linkedin: get("linkedin"),
            github: get("github"),
        };
    }

    private async fetchResumeText(url: string): Promise<string> {
        try {
            const res = await fetch(url);
            if (!res.ok) return "";
            const buffer = Buffer.from(await res.arrayBuffer());
            return await this.pdfTool.readPdfFromBuffer(buffer);
        } catch { return ""; }
    }

    private assembleProfile(mapped: MappedCandidateData, ai: any): ApplicantProfileJSON {
        return {
            first_name: mapped.first_name,
            last_name: mapped.last_name,
            email: mapped.email,
            headline: mapped.headline || ai?.headline || "",
            bio: mapped.bio || ai?.bio || "",
            location: ai?.location || "",
            skills: ai?.skills || [],
            languages: ai?.languages || [],
            experience: ai?.experience || [],
            education: ai?.education || [],
            projects: ai?.projects || [],
            availability: { status: "Open to Opportunities" },
            social_links: {
                linkedin: mapped.linkedin || ai?.social_links?.linkedin || null,
                github: mapped.github || ai?.social_links?.github || null,
                twitter: ai?.social_links?.twitter || null,
            }
        };
    }
}
