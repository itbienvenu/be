/**
 * ScreeningAIService — sends all candidates for a job to Gemini in ONE batch call.
 *
 * Extends BaseAIService<BatchAIResponse> so it inherits:
 *   - AJV schema validation of the response
 *   - Gemini responseSchema enforcement (structured output)
 *   - temperature: 0, topP: 0.1, topK: 40 (determinism)
 *   - 20 s timeout + error handling
 *
 * This service is responsible ONLY for building the prompt and calling the AI.
 * All scoring arithmetic lives in ScreeningScorer.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { BaseAIService } from "./ai.service.js";
import { batchAIResponseSchema } from "@/modules/screening/screening-batch-schema.js";
import type { BatchAIResponse, CandidateInput } from "@/modules/screening/screening.types.js";
import type { JobJSON } from "@/modules/job/job.types.js";

export class ScreeningAIService extends BaseAIService<BatchAIResponse> {
    protected readonly modelName = "gemini-2.5-flash-lite";
    protected readonly systemPrompt: string;

    constructor(apiKey?: string) {
        super(batchAIResponseSchema, apiKey);

        // Fail fast at startup if the prompt file is missing.
        // This prevents silent failures at screening time.
        try {
            this.systemPrompt = readFileSync(
                new URL("./prompts/screening-batch.prompt.txt", import.meta.url),
                "utf-8"
            );
        } catch {
            throw new Error(
                "ScreeningAIService: prompt file not found at src/modules/ai/prompts/screening-batch.prompt.txt"
            );
        }
    }

    /**
     * Send all candidates for a job to Gemini in a single batch call.
     *
     * The prompt is structured as:
     *   Section 1 — job context (title, seniority, domain, skills, soft skills, requirements)
     *   Section 2 — one condensed profile block per candidate
     *
     * Returns null if Gemini returns a malformed or incomplete response.
     * The caller (ScreeningService) handles the null case by defaulting all signals to 0.
     */
    async batchScreen(job: JobJSON, candidates: CandidateInput[]): Promise<BatchAIResponse | null> {
        const prompt = this.buildBatchPrompt(job, candidates);
        return this.callAI(prompt);
    }

    // ─── Prompt Builder ───────────────────────────────────────────────────────

    /**
     * Build the full batch prompt string.
     *
     * Job context is included once at the top to avoid repeating it per candidate.
     * Each candidate gets a condensed block with only the fields the AI needs
     * (structured skills, experience summary, education, bio, CV excerpt).
     * We cap the CV excerpt at 500 chars to stay within token limits for large batches.
     */
    private buildBatchPrompt(job: JobJSON, candidates: CandidateInput[]): string {
        const lines: string[] = [];

        // ── Section 1: Job Context ──────────────────────────────────────────
        lines.push("═══════════════════════════════════════════════════════════");
        lines.push("JOB CONTEXT");
        lines.push("═══════════════════════════════════════════════════════════");
        lines.push(`Title:      ${job.title}`);
        lines.push(`Seniority:  ${job.seniority_level ?? "not specified"}`);
        lines.push(`Domain:     ${job.domain.primary}`);
        lines.push(`Company:    ${job.company.name}, ${job.company.location.city}, ${job.company.location.country}`);
        lines.push("");

        // Required and optional hard skills with weights and expected levels
        lines.push("Hard Skills (name | required | weight | expected level):");
        for (const skill of (job.skills ?? [])) {
            lines.push(`  - ${skill.name} | required: ${skill.required} | weight: ${skill.weight} | level: ${skill.level}`);
        }
        lines.push("");

        // Soft skills with weights
        lines.push("Soft Skills (name | weight):");
        for (const ss of (job.soft_skills ?? [])) {
            lines.push(`  - ${ss.name} | weight: ${ss.weight ?? "unspecified"}`);
        }
        lines.push("");

        // Experience and education requirements
        const minYears = job.requirements?.experience?.min_years;
        lines.push(`Minimum experience: ${minYears != null ? `${minYears} years` : "not specified"}`);

        const eduReqs = job.requirements?.education ?? [];
        if (eduReqs.length > 0) {
            lines.push(`Education requirement: ${eduReqs.map(e => `${e.level} in ${e.fields.join(" / ")}`).join("; ")}`);
        }
        lines.push("");

        // ── Section 2: Candidate Profiles ──────────────────────────────────
        lines.push("═══════════════════════════════════════════════════════════");
        lines.push(`CANDIDATES (${candidates.length} total)`);
        lines.push("═══════════════════════════════════════════════════════════");

        for (const c of candidates) {
            lines.push(`--- Candidate: ${c.applicant_id} ---`);

            // Structured skills — guard against missing array in DB document
            const skillList = (c.profile.skills ?? [])
                .map(s => `${s.name} (${s.level}, ${s.years_of_experience ?? 0} yrs)`)
                .join(", ");
            lines.push(`Skills: ${skillList || "none listed"}`);

            // Experience summary — role, company, dates
            const expSummary = (c.profile.experience ?? [])
                .map(e => {
                    const end = e.is_current || !e.end_date ? "present" : e.end_date;
                    return `${e.role} at ${e.company} (${e.start_date} – ${end})`;
                })
                .join("; ");
            lines.push(`Experience: ${expSummary || "none listed"}`);

            // Highest education
            const edu = (c.profile.education ?? [])
                .map(e => `${e.degree}${e.field_of_study ? ` in ${e.field_of_study}` : ""}`)
                .join("; ");
            lines.push(`Education: ${edu || "none listed"}`);

            // Bio
            lines.push(`Bio: ${c.profile.bio || "not provided"}`);

            // CV text excerpt (capped at 500 chars to manage token usage)
            const cvExcerpt = c.cvRawText.slice(0, 500).replace(/\n+/g, " ").trim();
            lines.push(`CV Excerpt: ${cvExcerpt || "not available"}`);
            lines.push("");
        }

        return lines.join("\n");
    }
}
