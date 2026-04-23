import { ScreeningRepository } from "./screening.repository.js";
import { ScreeningScorer } from "./screening.scorer.js";
import { ScreeningAIService } from "@/modules/ai/screening.ai.service.js";
import { JobRepository } from "@/modules/job/job.repository.js";
import logger from "@/shared/utils/logger.js";
import { ForbiddenError } from "@/shared/utils/custom-errors.js";
import type {
    CandidateInput,
    ShortlistEntry,
    AICandidate,
    ScoredCandidate,
    ApplicationUpdate,
} from "./screening.types.js";

export class ScreeningService {
    private screeningRepo: ScreeningRepository;
    private jobRepo: JobRepository;
    private ai: ScreeningAIService;
    private scorer: ScreeningScorer;

    constructor() {
        this.screeningRepo = new ScreeningRepository();
        this.jobRepo = new JobRepository();
        this.ai = new ScreeningAIService();
        this.scorer = new ScreeningScorer();
    }

    /**
     * Verify that the job exists and belongs to the specified recruiter.
     * Throws ForbiddenError if validation fails.
     */
    async validateOwnership(jobId: string, recruiterId: string): Promise<any> {
        const job = await this.screeningRepo.findJob(jobId);
        if (!job || job.recruiterId !== recruiterId) {
            throw new ForbiddenError("Job not found or you do not have permission to access it");
        }
        return job;
    }

    /**
     * The main screening orchestration pipeline:
     *   1. Fetch job & applications
     *   2. Batch call Gemini AI
     *   3. Compute deterministic scores
     *   4. Rank candidates
     *   5. Persist results
     *   → sort & rank → persist → return shortlist
     */
    async screen(jobId: string, recruiterId: string): Promise<ShortlistEntry[]> {
        try {
            logger.info(`ScreeningService: Starting screening run for job ${jobId.substring(0, 5)}...`);

            // 1. Fetch the job - need scoring config and weights
            const job = await this.validateOwnership(jobId, recruiterId);

            // 2. Fetch all eligible applications
            const applications = await this.screeningRepo.findEligibleApplications(jobId);
            logger.info(`ScreeningService: Found ${applications.length} eligible applications for job ${jobId.substring(0, 5)}.`);

            if (applications.length === 0) {
                return [];
            }

            // 3. Assemble condensed CandidateInput[] for the AI and scorer
            const candidates: CandidateInput[] = applications.map(app => {
                if (!app.profile) {
                    logger.warn(`ScreeningService: applicant ${app.applicant_id} has no profile — fallback to empty default`);
                }
                return {
                    application_id: app.application_id,
                    applicant_id: app.applicant_id,
                    appliedAt: app.appliedAt,
                    cvRawText: app.cvRawText,
                    profile: app.profile || this.createEmptyProfile(),
                };
            });

            // 4. Batch call to Gemini — processed in CHUNKS of 5 to avoid 429 rate limits.
            const screeningRunAt = new Date();
            const chunkSize = 5;
            const aiResults: AICandidate[] = [];

            for (let i = 0; i < candidates.length; i += chunkSize) {
                const chunk = candidates.slice(i, i + chunkSize);
                logger.info(`ScreeningService: Processing chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(candidates.length/chunkSize)} for job ${jobId}...`);
                
                const chunkResponse = await this.ai.batchScreen(job, chunk);
                if (chunkResponse?.candidates) {
                    aiResults.push(...chunkResponse.candidates);
                }

                // Small cool-down between chunks if there are more to process
                if (i + chunkSize < candidates.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            const aiResultMap = new Map<string, AICandidate>(
                aiResults.map(c => [c.applicant_id, c])
            );

            // 5. Score each candidate deterministically.
            const scored: ScoredCandidate[] = candidates.map(candidate => {
                const aiResult = aiResultMap.get(candidate.applicant_id) ?? null;
                return this.scorer.score(job, candidate, aiResult, screeningRunAt);
            });

            // 6. Separate disqualified from eligible, then sort and rank
            const eligible = scored.filter(c => c.new_status !== "rejected");
            const disqualified = scored.filter(c => c.new_status === "rejected");

            // Sort eligible: primary = final_score DESC, tie-break = appliedAt ASC
            eligible.sort((a, b) =>
                b.screening_result.final_score - a.screening_result.final_score ||
                a.appliedAt.getTime() - b.appliedAt.getTime()
            );

            // Assign 1-based ranks to eligible candidates
            eligible.forEach((c, i) => { c.screening_result.rank = i + 1; });

            // 7. Write results back to the database
            logger.info(`ScreeningService: Persisting results for ${scored.length} candidates (eligible: ${eligible.length}, rejected: ${disqualified.length})...`);

            const updates: ApplicationUpdate[] = scored.map(s => ({
                application_id: s.application_id,
                screening_result: s.screening_result,
                new_status: s.new_status,
            }));

            await this.screeningRepo.saveScreeningResults(updates);

            // 8. Return the ranked shortlist
            return this.buildShortlistEntries(eligible, candidates);

        } catch (error: any) {
            logger.error(`SCREENING_PIPELINE_ERROR for job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Fetch the persisted shortlist for a job.
     */
    async getShortlist(jobId: string, recruiterId: string, limit: number = 10): Promise<ShortlistEntry[]> {
        await this.validateOwnership(jobId, recruiterId);

        const applications = await this.screeningRepo.findShortlist(jobId, limit);

        // Map to ShortlistEntry shape
        return applications.map((app: any) => ({
            application_id: app.application_id,
            applicant_id: app.applicant_id,
            first_name: app.first_name ?? "",
            last_name: app.last_name ?? "",
            headline: app.headline ?? "",
            profile: app.profile,
            screening_result: app.screening_result,
        }));
    }

    private buildShortlistEntries(
        scored: ScoredCandidate[],
        candidates: CandidateInput[]
    ): ShortlistEntry[] {
        const profileMap = new Map(candidates.map(c => [c.applicant_id, c.profile]));

        return scored.map(c => {
            const profile = profileMap.get(c.applicant_id);
            return {
                application_id: c.application_id,
                applicant_id: c.applicant_id,
                first_name: profile?.first_name ?? "",
                last_name: profile?.last_name ?? "",
                headline: profile?.headline ?? "",
                profile: profile!,
                screening_result: c.screening_result,
            };
        });
    }

    /**
     * Create a valid, empty profile object to prevent pipeline crashes
     * when a candidate has not yet filled their profile fields.
     */
    private createEmptyProfile(): any {
        return {
            first_name: "",
            last_name: "",
            email: "",
            headline: "",
            bio: "",
            location: "",
            skills: [],
            experience: [],
            education: [],
            projects: [],
            availability: {}
        };
    }
}
