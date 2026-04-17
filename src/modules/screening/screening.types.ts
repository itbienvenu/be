import type { ApplicantProfileJSON } from "@/modules/applicant/applicant.types.js";
import type { ApplicationStatus } from "@/modules/application/application.types.js";

// ─── AI Response Types ────────────────────────────────────────────────────────

/** Score the AI assigns to a single job skill for a candidate.
 *  1.0 = meets or exceeds required level
 *  0.5 = skill present but at a lower level
 *  0.0 = skill absent
 */
export interface SkillSignal {
    skill_name: string;
    score: 0 | 0.5 | 1.0;
}

/** Score the AI infers for a soft skill from CV text and bio.
 *  Range: 0.0 (no evidence) – 1.0 (strong evidence)
 */
export interface SoftSkillSignal {
    skill_name: string;
    score: number;
}

/** One candidate entry inside the Gemini batch response */
export interface AICandidate {
    applicant_id: string;
    skill_signals: SkillSignal[];
    soft_skill_signals: SoftSkillSignal[];
    strengths: string[];
    gaps: string[];
    recommendation: string;
}

/** Top-level shape of the Gemini batch response */
export interface BatchAIResponse {
    candidates: AICandidate[];
}

// ─── Scoring Types ────────────────────────────────────────────────────────────

/** Per-dimension scores, each in [0.0, 1.0], before applying category weights */
export interface DimensionBreakdown {
    skills: number;
    experience: number;
    education: number;
    resources: number;
    soft_skills: number;
}

/** The full screening result persisted on an Application document */
export interface ScreeningResult {
    rank: number | null;           // 1-based rank; null for disqualified candidates
    final_score: number;           // 0.00 – 100.00, rounded to 2dp
    dimension_breakdown: DimensionBreakdown;
    strengths: string[];
    gaps: string[];
    recommendation: string;
    screened_at: Date;
    ai_unavailable?: true;         // present when AI batch call failed; fallbacks were used
}

// ─── Pipeline Input / Output Types ───────────────────────────────────────────

/** Condensed candidate payload assembled by ScreeningService before calling scorer */
export interface CandidateInput {
    application_id: string;
    applicant_id: string;
    appliedAt: Date;
    cvRawText: string;
    profile: ApplicantProfileJSON;
}

/** Internal result produced by the scorer for a single candidate */
export interface ScoredCandidate {
    application_id: string;
    applicant_id: string;
    appliedAt: Date;
    screening_result: ScreeningResult;
    new_status: ApplicationStatus;
}

/** Payload written to MongoDB for each application after screening */
export interface ApplicationUpdate {
    application_id: string;
    screening_result: ScreeningResult;
    new_status: ApplicationStatus;
}

/** Shape returned by GET /jobs/:jobId/shortlist */
export interface ShortlistEntry {
    application_id: string;
    applicant_id: string;
    first_name: string;
    last_name: string;
    headline: string;
    screening_result: ScreeningResult;
}

/** Application joined with its applicant profile — used inside the repository */
export interface ApplicationWithApplicant {
    application_id: string;
    applicant_id: string;
    appliedAt: Date;
    cvRawText: string;
    status: ApplicationStatus;
    profile: ApplicantProfileJSON;
}
