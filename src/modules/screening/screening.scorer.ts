/**
 * ScreeningScorer — pure, stateless, deterministic scoring engine.
 *
 * No I/O of any kind. Given the same inputs this class always produces
 * the same outputs, which is the core guarantee of the screening pipeline.
 *
 * Scoring pipeline (in order):
 *   1. Compute candidate_total_years from experience dates
 *   2. Apply hard disqualification rules (before any arithmetic)
 *   3. Compute five dimension scores (skills, experience, education, resources, soft_skills)
 *   4. Combine with category weights → final_score (0–100)
 */

import type { JobJSON, Skill, Resource, SoftSkill } from "@/modules/job/job.types.js";
import type {
    CandidateInput,
    ScoredCandidate,
    AICandidate,
    SkillSignal,
    SoftSkillSignal,
    DimensionBreakdown,
    ScreeningResult,
} from "./screening.types.js";

// Degree → numeric tier used for education scoring.
// Higher tier = higher qualification.
const EDUCATION_TIERS: Record<string, number> = {
    none:        0.0,
    high_school: 0.25,
    associate:   0.5,
    bachelor:    0.75,
    master:      0.9,
    phd:         1.0,
};

export class ScreeningScorer {

    // ─── Public Entry Point ───────────────────────────────────────────────────

    /**
     * Score a single candidate against a job.
     *
     * @param job       - The job document (contains skills, weights, rules, requirements)
     * @param candidate - Condensed candidate profile assembled by ScreeningService
     * @param aiResult  - The AI-extracted signals for this candidate (may be null if AI failed)
     * @param asOf      - The reference timestamp for experience calculation.
     *                    Captured once per screening run so all candidates are scored
     *                    against the same point in time — guarantees determinism.
     * @returns ScoredCandidate with final_score, dimension_breakdown, strengths, gaps, rank=null
     *          (rank is assigned later by ScreeningService after sorting all candidates)
     */
    score(job: JobJSON, candidate: CandidateInput, aiResult: AICandidate | null, asOf: Date): ScoredCandidate {
        const skillSignals   = aiResult?.skill_signals      ?? [];
        const softSignals    = aiResult?.soft_skill_signals ?? [];
        const strengths      = aiResult?.strengths          ?? [];
        const gaps           = aiResult?.gaps               ?? [];
        const recommendation = aiResult?.recommendation     ?? "";

        // Step 1 — total years of experience (needed for both disqualification and scoring).
        // asOf is passed in from the service so the result is stable across reruns.
        const totalYears = this.computeTotalExperienceYears(candidate.profile?.experience ?? [], asOf);

        // Step 2 — Check for 'Soft' disqualification (violations go into gaps, but don't force 0)
        const disqual = this.applyDisqualificationRules(job, skillSignals, totalYears);
        const disqualGaps = disqual.reasons;

        // Step 3 — compute each dimension score (all values in [0.0, 1.0])
        const skillsScore     = this.computeSkillsScore(job.skills ?? [], skillSignals);
        const experienceScore = this.computeExperienceScore(totalYears, job.requirements?.experience?.min_years);
        const educationScore  = this.computeEducationScore(candidate.profile?.education ?? [], job.requirements?.education);
        const resourcesScore  = this.computeResourcesScore(job.resources ?? [], candidate.profile?.skills ?? [], candidate.cvRawText ?? "");
        const softSkillsScore = this.computeSoftSkillsScore(job.soft_skills ?? [], softSignals);

        const breakdown: DimensionBreakdown = {
            skills:     skillsScore,
            experience: experienceScore,
            education:  educationScore,
            resources:  resourcesScore,
            soft_skills: softSkillsScore,
        };

        // Step 4 — weighted combination → final score 0–100
        const finalScore = this.computeFinalScore(breakdown, job);

        // If the AI was unavailable (null aiResult), generate deterministic fallbacks
        // from the computed dimension_breakdown so the API contract is always satisfied.
        const aiUnavailable = aiResult === null;
        const finalStrengths = aiUnavailable ? this.buildFallbackStrengths(breakdown, job) : strengths;
        // Combine AI gaps with hard-rule violation gaps (like missing years of experience)
        const finalGaps = [
            ...(aiUnavailable ? this.buildFallbackGaps(breakdown, job) : gaps),
            ...disqualGaps
        ];
        const finalRecommendation = aiUnavailable ? this.buildFallbackRecommendation(breakdown, job, finalScore) : recommendation;

        const result: ScreeningResult = {
            rank: null,   // assigned by ScreeningService after sorting
            final_score: finalScore,
            dimension_breakdown: breakdown,
            strengths:      finalStrengths,
            gaps:           finalGaps,
            recommendation: finalRecommendation,
            screened_at: asOf,
            ...(aiUnavailable && { ai_unavailable: true as const }),
        };

        // Strict Status Logic:
        // 1. If disqualified by hard rules, they are 'rejected' unless their final_score 
        //    is exceptionally high (>= 85), in which case we shortlist but flag the gaps.
        // 2. If not disqualified, they must still meet a minimum threshold (>= 60) to be shortlisted.
        let status: "shortlisted" | "rejected" = "rejected";
        
        if (disqual.disqualified) {
            if (finalScore >= 85) {
                status = "shortlisted";
            } else {
                status = "rejected";
            }
        } else {
            // Not disqualified, but must still be a good match
            status = finalScore >= 60 ? "shortlisted" : "rejected";
        }

        return {
            application_id: candidate.application_id,
            applicant_id:   candidate.applicant_id,
            appliedAt:      candidate.appliedAt,
            screening_result: result,
            new_status: status,
        };
    }

    // ─── Dimension Scorers ────────────────────────────────────────────────────

    /**
     * Skills score — weighted average of AI skill signals.
     *
     * Formula: Σ(signal.score × skill.weight) / Σ(skill.weight)
     *
     * Each job skill has its own weight reflecting its importance to the role.
     * The AI returns a signal per skill (0 / 0.5 / 1.0). We multiply signal by
     * weight, sum everything, then normalise by the total weight so the result
     * stays in [0.0, 1.0] regardless of how many skills the job has.
     */
    computeSkillsScore(skills: Skill[], signals: SkillSignal[]): number {
        if (skills.length === 0) return 1.0; // no skills defined → full score

        let weightedSum = 0;
        let totalWeight = 0;

        for (const skill of skills) {
            const signal = signals.find(s => s.skill_name.toLowerCase() === skill.name.toLowerCase());
            const score  = signal?.score ?? 0.0; // missing signal defaults to 0
            weightedSum += score * skill.weight;
            totalWeight += skill.weight;
        }

        if (totalWeight === 0) return 0.0;
        return this.round(weightedSum / totalWeight, 6);
    }

    /**
     * Experience score — linear scale capped at 1.0.
     *
     * Formula: min(totalYears / minYears, 1.0)
     *
     * A candidate who exactly meets the minimum gets 1.0.
     * A candidate with more experience also gets 1.0 (no bonus for over-qualification).
     * If no minimum is specified the candidate gets full score.
     */
    computeExperienceScore(totalYears: number, minYears?: number): number {
        if (!minYears || minYears <= 0) return 1.0; // no requirement → full score
        return this.round(Math.min(totalYears / minYears, 1.0), 6);
    }

    /**
     * Education score — tier comparison.
     *
     * Formula: min(candidateTier / requiredTier, 1.0)
     *
     * Degrees are mapped to numeric tiers (none=0 … phd=1.0).
     * We take the candidate's highest degree and the job's highest required degree,
     * then compute the ratio. Meeting or exceeding the requirement yields 1.0.
     * If no education requirement is specified the candidate gets full score.
     */
    computeEducationScore(
        education: CandidateInput["profile"]["education"],
        required?: { level: string; fields: string[] }[]
    ): number {
        if (!required || required.length === 0) return 1.0; // no requirement → full score

        // Find the highest required tier
        const requiredTier = Math.max(
            ...required.map(r => EDUCATION_TIERS[r.level.toLowerCase()] ?? 0)
        );
        if (requiredTier === 0) return 1.0;

        // Find the candidate's highest degree tier
        const candidateTier = Math.max(
            0,
            ...education.map(e => {
                // Normalise degree strings like "Bachelor of Science" → "bachelor"
                const degreeKey = e.degree.toLowerCase().split(" ")[0];
                return EDUCATION_TIERS[degreeKey as keyof typeof EDUCATION_TIERS] ?? 0;
            })
        );

        return this.round(Math.min(candidateTier / requiredTier, 1.0), 6);
    }

    /**
     * Resources score — proportion of required tools/resources the candidate has.
     *
     * Formula: matched_required / total_required
     *
     * A resource is considered matched if its name appears (case-insensitive) in
     * the candidate's structured skill list OR anywhere in their raw CV text.
     * Only resources marked required:true count toward the denominator.
     */
    computeResourcesScore(
        resources: Resource[],
        candidateSkills: CandidateInput["profile"]["skills"],
        cvRawText: string
    ): number {
        const required = resources.filter(r => r.required);
        if (required.length === 0) return 1.0; // no required resources → full score

        const cvLower = cvRawText.toLowerCase();
        const skillNames = candidateSkills.map(s => s.name.toLowerCase());

        const matched = required.filter(r => {
            const name = r.name.toLowerCase();
            return skillNames.includes(name) || cvLower.includes(name);
        });

        return this.round(matched.length / required.length, 6);
    }

    /**
     * Soft skills score — weighted average of AI soft skill signals.
     *
     * Formula: Σ(signal.score × soft_skill.weight) / Σ(soft_skill.weight)
     *
     * Same weighted-average logic as skills score, but the AI infers these
     * from unstructured CV text and bio rather than a structured skill list.
     * If the job defines no soft skills the score is 0.0 (per requirement 4.3).
     */
    computeSoftSkillsScore(softSkills: SoftSkill[], signals: SoftSkillSignal[]): number {
        if (softSkills.length === 0) return 0.0; // no soft skills defined → 0 (req 4.3)

        let weightedSum = 0;
        let totalWeight = 0;

        for (const ss of softSkills) {
            const weight = ss.weight ?? 1.0; // default weight if not specified
            const signal = signals.find(s => s.skill_name.toLowerCase() === ss.name.toLowerCase());
            const score  = signal?.score ?? 0.0;
            weightedSum += score * weight;
            totalWeight += weight;
        }

        if (totalWeight === 0) return 0.0;
        return this.round(weightedSum / totalWeight, 6);
    }

    // ─── Final Score ──────────────────────────────────────────────────────────

    /**
     * Combine dimension scores using the job's category weights.
     *
     * Formula:
     *   raw = skills×w.skills + experience×w.experience + education×w.education
     *         + resources×w.resources + soft_skills×w.soft_skills
     *   final_score = round(raw × 100, 2)
     *
     * Weights are normalised at scoring time so the result is always in [0, 100]
     * even if the job's weights don't sum to exactly 1.0. A warning is logged
     * when normalisation is applied so misconfigured jobs are detectable.
     *
     * Intermediate dimension scores are already rounded to 6dp.
     * The final score is rounded to 2dp and expressed on a 0–100 scale.
     */
    private computeFinalScore(breakdown: DimensionBreakdown, job: JobJSON): number {
        // Defensive access: ensure weights exist, fallback to equal distribution if missing
        const w = job.scoring_config?.weights ?? {
            skills: 0.2,
            experience: 0.2,
            education: 0.2,
            resources: 0.2,
            soft_skills: 0.2
        };
        const weightSum = (w.skills ?? 0) + (w.experience ?? 0) + (w.education ?? 0) + (w.resources ?? 0) + (w.soft_skills ?? 0);

        // Normalise weights so they always sum to 1.0.
        // If the job is correctly configured (sum ≈ 1.0) this is a no-op.
        // If misconfigured, we self-heal and log a warning so it's detectable.
        const epsilon = 0.0001;
        let skills = w.skills ?? 0, 
            experience = w.experience ?? 0, 
            education = w.education ?? 0,
            resources = w.resources ?? 0, 
            soft_skills = w.soft_skills ?? 0;

        if (Math.abs(weightSum - 1.0) > epsilon) {
            if (weightSum <= 0) {
                // Degenerate case — fall back to equal weights
                skills = experience = education = resources = soft_skills = 0.2;
                console.warn(
                    `[ScreeningScorer] Job scoring_config weights sum to ${weightSum} (invalid). ` +
                    `Falling back to equal weights (0.2 each). Job: ${(job as any)._id ?? "unknown"}`
                );
            } else {
                skills      = w.skills      / weightSum;
                experience  = w.experience  / weightSum;
                education   = w.education   / weightSum;
                resources   = w.resources   / weightSum;
                soft_skills = w.soft_skills / weightSum;
                console.warn(
                    `[ScreeningScorer] Job scoring_config weights sum to ${weightSum.toFixed(4)} (expected 1.0). ` +
                    `Normalised automatically. Job: ${(job as any)._id ?? "unknown"}`
                );
            }
        }

        const raw =
            breakdown.skills      * skills      +
            breakdown.experience  * experience  +
            breakdown.education   * education   +
            breakdown.resources   * resources   +
            breakdown.soft_skills * soft_skills;

        return this.round(raw * 100, 2);
    }

    // ─── Disqualification ─────────────────────────────────────────────────────

    /**
     * Apply hard disqualification rules BEFORE computing any scores.
     *
     * Why before arithmetic? Because a disqualified candidate should never
     * appear in the shortlist regardless of how well they score on other
     * dimensions. Checking first avoids wasting compute on scoring them.
     *
     * Rule A: required_skills_must_match — any required skill with signal 0.0 → disqualify
     * Rule B: min_experience_required    — totalYears < minYears → disqualify
     */
    private applyDisqualificationRules(
        job: JobJSON,
        signals: SkillSignal[],
        totalYears: number
    ): { disqualified: boolean; reasons: string[] } {
        const reasons: string[] = [];
        // Defensive access: default to non-strict rules if missing
        const rules = job.scoring_config?.rules ?? {
            required_skills_must_match: false,
            min_experience_required: false
        };

        // Rule A — required skills must all be present
        if (rules.required_skills_must_match) {
            for (const skill of (job.skills ?? [])) {
                if (!skill.required) continue;
                const signal = signals.find(s => s.skill_name.toLowerCase() === skill.name.toLowerCase());
                if (!signal || signal.score === 0.0) {
                    reasons.push(`Required skill missing or not demonstrated: ${skill.name}`);
                }
            }
        }

        // Rule B — minimum years of experience (with 15% "human" tolerance)
        if (rules.min_experience_required) {
            const minYears = job.requirements?.experience?.min_years ?? 0;
            const toleranceFactor = 0.85; // 15% tolerance (e.g., 1.7 years matches a 2-year requirement)
            
            if (minYears > 0 && totalYears < (minYears * toleranceFactor)) {
                reasons.push(
                    `Experience significantly below minimum: ${totalYears.toFixed(1)} years provided, ${minYears} required`
                );
            }
        }

        return { disqualified: reasons.length > 0, reasons };
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Sum total years of experience across all experience entries.
     *
     * For current roles (is_current=true or no end_date) we use `asOf` as the
     * end date — NOT new Date(). This keeps the result stable across reruns
     * as long as the same `asOf` timestamp is used, satisfying the determinism guarantee.
     * Duration is expressed in fractional years (days / 365.25).
     */
    private computeTotalExperienceYears(
        experience: CandidateInput["profile"]["experience"],
        asOf: Date
    ): number {
        let totalDays = 0;

        for (const entry of experience) {
            const start = new Date(entry.start_date);
            // Cap the end date at 'asOf' (today) to avoid "future experience" hallucinations
            let end = entry.is_current || !entry.end_date ? asOf : new Date(entry.end_date);
            
            if (end > asOf) {
                end = asOf;
            }

            const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            if (days > 0) totalDays += days;
        }

        return totalDays / 365.25;
    }

    // ─── AI Fallbacks ─────────────────────────────────────────────────────────

    /**
     * Generate deterministic strengths from dimension_breakdown when AI is unavailable.
     * Any dimension scoring ≥ 0.7 is considered a strength.
     */
    private buildFallbackStrengths(breakdown: DimensionBreakdown, job: JobJSON): string[] {
        const strengths: string[] = [];
        if (breakdown.skills >= 0.7)
            strengths.push(`Strong skills alignment with the ${job.title} requirements`);
        if (breakdown.experience >= 0.7)
            strengths.push(`Meets or exceeds the required years of experience`);
        if (breakdown.education >= 0.7)
            strengths.push(`Education level meets the role requirements`);
        if (breakdown.resources >= 0.7)
            strengths.push(`Has the required tools and resources`);
        if (breakdown.soft_skills >= 0.7)
            strengths.push(`Demonstrates relevant soft skills for the role`);
        return strengths.length > 0 ? strengths : ["Profile reviewed — see dimension scores for details"];
    }

    /**
     * Generate deterministic gaps from dimension_breakdown when AI is unavailable.
     * Any dimension scoring < 0.5 is flagged as a gap.
     */
    private buildFallbackGaps(breakdown: DimensionBreakdown, job: JobJSON): string[] {
        const gaps: string[] = [];
        if (breakdown.skills < 0.5)
            gaps.push(`Skills match below expectations for ${job.title}`);
        if (breakdown.experience < 0.5)
            gaps.push(`Experience level may not meet the minimum requirement`);
        if (breakdown.education < 0.5)
            gaps.push(`Education level below the role requirement`);
        if (breakdown.resources < 0.5)
            gaps.push(`Missing some required tools or resources`);
        return gaps;
    }

    /**
     * Generate a deterministic recommendation summary when AI is unavailable.
     * Based purely on the final_score band.
     */
    private buildFallbackRecommendation(breakdown: DimensionBreakdown, job: JobJSON, finalScore: number): string {
        const title = job.title;
        if (finalScore >= 80)
            return `This candidate is a strong match for the ${title} role based on their profile scores. ` +
                   `Skills and experience alignment are both high. Recommended for further review.`;
        if (finalScore >= 60)
            return `This candidate shows a reasonable fit for the ${title} role. ` +
                   `Some dimensions score well while others may need verification. Consider for interview.`;
        if (finalScore >= 40)
            return `This candidate partially meets the requirements for the ${title} role. ` +
                   `Key gaps exist in one or more dimensions. Review carefully before proceeding.`;
        return `This candidate does not strongly match the ${title} role based on available profile data. ` +
               `Significant gaps were identified across multiple dimensions.`;
    }

    /**
     * Round a number to a fixed number of decimal places.
     * Used for 6dp on intermediates and 2dp on the final score.
     */
    round(value: number, places: number): number {
        const factor = Math.pow(10, places);
        return Math.round(value * factor) / factor;
    }
}
