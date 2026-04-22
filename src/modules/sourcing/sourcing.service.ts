
import XLSX from "xlsx";
import { PDFTool } from "@/shared/utils/pdfs-tool.js";
import { SourcingAIService } from "./sourcing.ai.service.js";
import { ApplicantRepository } from "@/modules/applicant/applicant.repository.js";
import { ApplicationRepository } from "@/modules/application/application.repository.js";
import { JobRepository } from "@/modules/job/job.repository.js";
import logger from "@/shared/utils/logger.js";
import type {
    SourcingBulkUploadRequest,
    SourcingBulkUploadResponse,
    RawCandidateRow,
    MappedCandidateData,
    CandidateProcessResult,
    ColumnMapping,
    TalentProfile,
} from "./sourcing.types.js";

/**
 * Sourcing Service
 * 
 * Orchestrates recruiter-driven candidate sourcing flows:
 * - Bulk importing candidates from spreadsheets
 * - Linking them to specific jobs
 * - Using AI to normalize resume data specifically for the Hackathon Ranking System.
 */
export class SourcingService {
    private pdfTool: PDFTool;
    private cvParser: SourcingAIService;
    private applicantRepo: ApplicantRepository;
    private applicationRepo: ApplicationRepository;
    private jobRepo: JobRepository;

    constructor() {
        this.pdfTool = new PDFTool();
        this.cvParser = new SourcingAIService();
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
                message: "Internal server error during processing",
            };
        }
    }

    private parseFile(buffer: Buffer, filename: string): RawCandidateRow[] {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error("File contains no sheets");

        const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]!);
        return rows.map((data, index) => ({ row_number: index + 2, data }));
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

        let currentStage: "validation" | "fetch" | "parse" | "save" = "validation";

        try {
            const mapped = this.mapRow(row.data, mapping);
            Object.assign(result, { first_name: mapped.first_name, last_name: mapped.last_name, email: mapped.email });

            if (!mapped.email) throw new Error("Email is required");

            currentStage = "fetch";
            // 1. Determine the "Identity" (userId) for this applicant.
            // We want a valid ObjectId string consistently across the platform.
            let foundUserId: string;

            // Try finding applicant profile first (it contains the link to userId)
            const existingApplicant = await this.applicantRepo.findByEmail(mapped.email);
            
            if (existingApplicant) {
                foundUserId = existingApplicant.userId.toString();
            } else {
                // No profile yet, check if a user exists with this email
                const authRepo = new (await import("@/modules/auth/auth.repository.js")).AuthRepository();
                const user = await authRepo.findByEmail(mapped.email);
                
                if (user && user._id) {
                    foundUserId = user._id.toString();
                } else {
                    foundUserId = new (await import("mongodb")).ObjectId().toString();
                }
            }

            let resumeText = "";
            if (mapped.resume_url) {
                resumeText = await this.fetchResumeText(mapped.resume_url);
            }

            currentStage = "parse";
            // AI results will now follow the Hackathon Schema via SourcingAIService
            const aiProfile = resumeText ? await this.cvParser.parseCV(resumeText) : null;
            
            currentStage = "save";
            // Dual-profile mapping: platformProfile for platform usage, sourcing_profile for hackathon spec.
            const { platformProfile, sourcing_profile } = this.assembleProfile(mapped, aiProfile);

            if (existingApplicant) {
                // Safe-Patching: Update individual profile paths to avoid overwriting existing data (like nationality, gender)
                // that might not be in the sourcing CV but exists on the profile already.
                const updatePayload: Record<string, any> = {
                    cvRawText: resumeText || existingApplicant.cvRawText,
                    cvUrl: mapped.resume_url || existingApplicant.cvUrl,
                    sourcing_profile: sourcing_profile // Hackathon data usually gets full-reset per sourcing run
                };

                // Map standard profile fields to dot-notation for safety
                Object.entries(platformProfile).forEach(([key, value]) => {
                    if (value !== undefined) updatePayload[`profile.${key}`] = value;
                });

                await this.applicantRepo.patchByUserId(foundUserId, updatePayload);
            } else {
                await this.applicantRepo.createImported({
                    userId: foundUserId,
                    cvUrl: mapped.resume_url || "",
                    cvPublicId: `src-${Date.now()}-${row.row_number}`,
                    cvRawText: resumeText,
                    profile: platformProfile as any,
                    sourcing_profile: sourcing_profile as any
                } as any);
            }

            // Consistently use foundUserId (the ObjectId-compatible string) as applicantId in applications
            const applicantId = foundUserId;
            result.applicantId = applicantId;

            const existingApp = await this.applicationRepo.findByApplicantAndJob(applicantId, jobId);
            if (existingApp) {
                result.applicationId = existingApp._id!.toString();
                result.success = true;
                return result;
            }

            const application = await this.applicationRepo.create({
                applicantId, jobId, status: "pending", appliedAt: new Date(),
                cvUrl: mapped.resume_url || "", cvRawText: resumeText
            });

            if (application?._id) {
                result.applicationId = application._id.toString();
                result.success = true;
            }
        } catch (error: any) {
            result.error = { stage: currentStage, message: error.message };
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
            location: get("location"),
            linkedin: get("linkedin"),
            github: get("github"),
            portfolio: get("portfolio"),
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

    private assembleProfile(mapped: MappedCandidateData, ai: any) {
        // 1. Create the platform-standard profile (snake_case)
        // This ensures the candidate displays correctly in the dashboard and works with the screening engine.
        const platformProfile = {
            first_name: mapped.first_name,
            last_name: mapped.last_name,
            email: mapped.email,
            headline: mapped.headline || ai?.["Headline"] || ai?.headline || "Applicant",
            bio: mapped.bio || ai?.["Bio"] || ai?.bio || "",
            location: mapped.location || ai?.["Location"] || ai?.location || "Unknown",
            skills: (ai?.skills || []).map((s: any) => ({
                name: s.name,
                level: s.level,
                years_of_experience: s.yearsOfExperience || s.years_of_experience || 0
            })),
            languages: (ai?.languages || []).map((l: any) => ({
                name: l.name,
                proficiency: l.proficiency === "Fluent" ? "Advanced" : l.proficiency // Mapping Basic/Fluent to Beginner/Advanced if needed
            })),
            experience: (ai?.experience || []).map((e: any) => ({
                company: e.company,
                role: e.role,
                start_date: e["Start Date"] || e.start_date || "",
                end_date: e["End Date"] || e.end_date || "",
                description: e.description || "",
                technologies: e.technologies || [],
                is_current: !!(e["Is Current"] || e.is_current),
                work_type: "Full-time" // Default
            })),
            education: (ai?.education || []).map((e: any) => ({
                institution: e.institution,
                degree: e.degree,
                field_of_study: e["Field of Study"] || e.field_of_study || "",
                start_date: e["Start Year"] ? `${e["Start Year"]}-01-01` : (e.start_date || ""),
                end_date: e["End Year"] ? `${e["End Year"]}-01-01` : (e.end_date || "")
            })),
            projects: (ai?.projects || []).map((p: any) => ({
                name: p.name,
                description: p.description || "",
                technologies: p.technologies || [],
                link: p.link || null,
                start_date: p["Start Date"] || p.start_date || "",
                end_date: p["End Date"] || p.end_date || ""
            })),
            availability: {
                status: ai?.availability?.status || "Open to Opportunities",
                type: ai?.availability?.type === "Contract" ? "Freelance" : (ai?.availability?.type || "Full-time"),
                start_date: ai?.availability?.["Start Date"] || ai?.availability?.start_date || null
            },
            social_links: {
                linkedin: mapped.linkedin || ai?.socialLinks?.linkedin || ai?.social_links?.linkedin || null,
                github: mapped.github || ai?.socialLinks?.github || ai?.social_links?.github || null,
                twitter: null
            }
        };

        // 2. Create the Hackathon-specific Talent Profile (CSV Key Style)
        // This keeps the module compliant with the exact schema requested for the AI Ranking.
        const sourcing_profile: TalentProfile = {
            "First Name": mapped.first_name,
            "Last Name": mapped.last_name,
            "Email": mapped.email,
            "Headline": platformProfile.headline,
            "Bio": platformProfile.bio,
            "Location": platformProfile.location,
            "skills": ai?.skills || [],
            "languages": ai?.languages || [],
            "experience": ai?.experience || [],
            "education": ai?.education || [],
            "projects": ai?.projects || [],
            "availability": ai?.availability || { status: "Open to Opportunities", type: "Full-time" },
            "socialLinks": {
                "linkedin": platformProfile.social_links.linkedin,
                "github": platformProfile.social_links.github,
                "portfolio": mapped.portfolio || ai?.socialLinks?.portfolio || null,
            }
        };

        return { platformProfile, sourcing_profile };
    }
}
