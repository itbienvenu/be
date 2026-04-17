/**
 * ScreeningService — orchestrates the full screening pipeline.
 *
 * Responsibilities:
 *   1. Validate recruiter ownership of the job
 *   2. Fetch eligible applications + applicant profiles
 *   3. Send all candidates to Gemini in ONE batch call
 *   4. Run the deterministic scorer per candidate
 *   5. Sort, rank, and persist results
 *   6. Return the ranked shortlist
 *
 * This class contains no AI logic and no scoring arithmetic —
 * those live in ScreeningAIService and ScreeningScorer respectively.
 */

import { ScreeningAIService } from "@/modules/ai/screening.ai.service.js";
import { ScreeningScorer } from "./screening.scorer.js";
import { ScreeningRepository } from "./screening.repository.js";
import type {
    CandidateInput,
    ScoredCandidate,
    ApplicationUpdate,
    ShortlistEntry,
    AICandidate,
} from "./screening.types.js";
import { ForbiddenError } from "@/shared/utils/custom-errors.js";
import logger from "@/shared/utils/logger.js";

export class ScreeningService {
    private readonly ai:     ScreeningAIService;
    private readonly scorer: ScreeningScorer;
    private readonly repo:   ScreeningRepository;

    constructor() {
        this.ai     = new ScreeningAIService();
        this.scorer = new ScreeningScorer();
        this.repo   = new ScreeningRepository();
    }

    // ─── POST /jobs/:jobId/screen ─────────────────────────────────────────────

    /**
     * Run AI screening for all eligible applications on a job.
     *
     * Pipeline:
     *   fetch job → fetch applications → batch AI call → score each candidate
     *   → sort & rank → persist → return shortlist
     */
    async screen(jobId: string, recruiterId: string): Promise<ShortlistEntry[]> {
        // 1. Fetch job and verify recruiter ownership
        const job = await this.repo.findJob(jobId);
        logger.info(`ScreeningService.screen: jobId=${jobId}, recruiterId=${recruiterId}, job.recruiterId=${job?.recruiterId}, found=${!!job}`);
        if (!job || job.recruiterId !== recruiterId) {
            throw new ForbiddenError("Job not found or you do not have permission to screen it");
        }

        // 2. Fetch all pending/reviewed applications with applicant profiles
        const applications = await this.repo.findEligibleApplications(jobId);
        if (applications.length === 0) {
            logger.info(`ScreeningService: no eligible applications for job ${jobId}`);
            return [];
        }

        // 3. Assemble condensed CandidateInput[] for the AI and scorer
        const candidates: CandidateInput[] = applications.map(app => ({
            application_id: app.application_id,
            applicant_id:   app.applicant_id,
            appliedAt:      app.appliedAt,
            cvRawText:      app.cvRawText,
            profile:        app.profile,
        }));

        // 4. ONE batch call to Gemini — all candidates sent together.
        //    If the AI fails (returns null), we default all signals to 0
        //    and continue with scoring so the pipeline never fully breaks.
        const aiResponse = await this.ai.batchScreen(job, candidates);
        if (!aiResponse) {
            logger.warn(`ScreeningService: AI batch call returned null for job ${jobId} — defaulting all signals to 0`);
        }
        // Build a lookup map: applicant_id → AICandidate for O(1) access in the loop
        const aiResultMap = new Map<string, AICandidate>(
            (aiResponse?.candidates ?? []).map(c => [c.applicant_id, c])
        );

        // 5. Score each candidate deterministically
        const scored: ScoredCandidate[] = candidates.map(candidate => {
            const aiResult = aiResultMap.get(candidate.applicant_id) ?? null;
            return this.scorer.score(job, candidate, aiResult);
        });

        // 6. Separate disqualified from eligible, then sort and rank
        const eligible     = scored.filter(c => c.new_status !== "rejected");
        const disqualified = scored.filter(c => c.new_status === "rejected");

        // Sort eligible: primary = final_score DESC, tie-break = appliedAt ASC
        eligible.sort((a, b) =>
            b.screening_result.final_score - a.screening_result.final_score ||
            a.appliedAt.getTime() - b.appliedAt.getTime()
        );

        // Assign 1-based ranks to eligible candidates
        eligible.forEach((c, i) => { c.screening_result.rank = i + 1; });

        // 7. Persist all results (shortlisted + rejected) before returning
        const updates: ApplicationUpdate[] = [...eligible, ...disqualified].map(c => ({
            application_id:   c.application_id,
            screening_result: c.screening_result,
            new_status:       c.new_status,
        }));
        await this.repo.saveScreeningResults(updates);

        // 8. Return the ranked shortlist (top candidates only, no disqualified)
        return this.buildShortlistEntries(eligible, candidates);
    }

    // ─── GET /jobs/:jobId/shortlist ───────────────────────────────────────────

    /**
     * Retrieve the persisted ranked shortlist for a job.
     * Results are already sorted and stored — this is a simple DB read.
     */
    async getShortlist(jobId: string, recruiterId: string, limit: 10 | 20): Promise<ShortlistEntry[]> {
        // Verify recruiter owns the job before exposing results
        const job = await this.repo.findJob(jobId);
        if (!job || job.recruiterId !== recruiterId) {
            throw new ForbiddenError("Job not found or you do not have permission to view this shortlist");
        }

        return this.repo.findShortlist(jobId, limit);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Build ShortlistEntry[] from scored candidates + original candidate inputs.
     * We pull first_name, last_name, headline from the profile for the response.
     */
    private buildShortlistEntries(
        scored: ScoredCandidate[],
        candidates: CandidateInput[]
    ): ShortlistEntry[] {
        const profileMap = new Map(candidates.map(c => [c.applicant_id, c.profile]));

        return scored.map(c => {
            const profile = profileMap.get(c.applicant_id);
            return {
                application_id:   c.application_id,
                applicant_id:     c.applicant_id,
                first_name:       profile?.first_name ?? "",
                last_name:        profile?.last_name  ?? "",
                headline:         profile?.headline   ?? "",
                screening_result: c.screening_result,
            };
        });
    }
}
