/**
 * Screening module — OpenAPI schemas and path definitions.
 *
 * Endpoints:
 *   POST /api/v1/jobs/:jobId/screen          — trigger AI screening for all eligible applications
 *   GET  /api/v1/jobs/:jobId/shortlist        — retrieve the ranked shortlist
 *
 * All endpoints require: Authorization: Bearer <token>  (role: recruiter, must own the job)
 *
 * How screening works:
 *   1. Recruiter triggers POST /screen
 *   2. All pending/reviewed applications are sent to Gemini AI in ONE batch call
 *   3. AI returns skill signals and soft skill signals per candidate
 *   4. Deterministic scoring engine computes final_score (0–100) using weighted average
 *   5. Candidates are ranked, results persisted, shortlist returned
 */

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const screeningSchemas = {

    DimensionBreakdown: {
        type: "object",
        description: "Per-dimension scores used to compute the final weighted score. Each value is 0.0–1.0.",
        required: ["skills", "experience", "education", "resources", "soft_skills"],
        properties: {
            skills:      { type: "number", minimum: 0, maximum: 1, description: "Weighted average of AI skill match signals", example: 0.82 },
            experience:  { type: "number", minimum: 0, maximum: 1, description: "min(candidate_years / required_years, 1.0)", example: 1.0 },
            education:   { type: "number", minimum: 0, maximum: 1, description: "Candidate degree tier vs required degree tier", example: 0.75 },
            resources:   { type: "number", minimum: 0, maximum: 1, description: "Proportion of required tools matched", example: 1.0 },
            soft_skills: { type: "number", minimum: 0, maximum: 1, description: "Weighted average of AI soft skill inference signals", example: 0.65 }
        }
    },

    ScreeningResult: {
        type: "object",
        required: ["rank", "final_score", "dimension_breakdown", "strengths", "gaps", "recommendation", "screened_at"],
        properties: {
            rank: {
                type: "integer",
                nullable: true,
                description: "1-based rank among shortlisted candidates. null if the candidate was disqualified.",
                example: 1
            },
            final_score: {
                type: "number",
                minimum: 0,
                maximum: 100,
                description:
                    "Final weighted score (0–100, rounded to 2dp). " +
                    "Formula: (skills×0.5 + experience×0.25 + education×0.1 + resources×0.05 + soft_skills×0.1) × 100",
                example: 78.5
            },
            dimension_breakdown: { $ref: "#/components/schemas/DimensionBreakdown" },
            strengths: {
                type: "array",
                items: { type: "string" },
                description: "AI-generated list of candidate strengths relevant to this role",
                example: ["Strong Python proficiency at advanced level", "Meets minimum experience requirement"]
            },
            gaps: {
                type: "array",
                items: { type: "string" },
                description: "AI-generated list of gaps or missing requirements. Empty array if no gaps.",
                example: ["SQL experience below intermediate level"]
            },
            recommendation: {
                type: "string",
                description: "AI-generated 2–4 sentence summary of candidate fit for this specific role",
                example: "Alice is a strong match for the mid-level Software Tools Engineer role. Her Python and API development skills are well above the required level. Minor gap in SQL proficiency but overall highly recommended for interview."
            },
            screened_at: {
                type: "string",
                format: "date-time",
                description: "Timestamp when this candidate was scored (same for all candidates in a single screening run)",
                example: "2026-04-17T14:30:00.000Z"
            },
            ai_unavailable: {
                type: "boolean",
                description: "Present and true only when the Gemini AI call failed. Scores are deterministic but strengths/gaps/recommendation are generated from dimension scores as fallback.",
                example: true
            }
        }
    },

    ShortlistEntry: {
        type: "object",
        required: ["application_id", "applicant_id", "first_name", "last_name", "headline", "screening_result"],
        properties: {
            application_id: { type: "string", description: "Application MongoDB ObjectId", example: "661f1b2c3d4e5f6a7b8c9d0e" },
            applicant_id:   { type: "string", description: "Applicant MongoDB ObjectId", example: "661f1b2c3d4e5f6a7b8c9d0f" },
            first_name:     { type: "string", example: "Alice" },
            last_name:      { type: "string", example: "Uwimana" },
            headline:       { type: "string", example: "Full-Stack Software Engineer" },
            screening_result: { $ref: "#/components/schemas/ScreeningResult" }
        }
    }
};

// ─── Paths ────────────────────────────────────────────────────────────────────

export const screeningPaths = {

    "/api/v1/jobs/{jobId}/screen": {
        post: {
            tags: ["Screening"],
            summary: "Trigger AI screening for a job",
            description:
                "Evaluates all eligible applications (status: `pending` or `reviewed`) for the specified job " +
                "using a single Gemini AI batch call followed by deterministic weighted scoring. " +
                "\n\n**Scoring formula:**" +
                "\n```\nfinal_score = (\n  skills_score      × weights.skills      +\n  experience_score  × weights.experience  +\n  education_score   × weights.education   +\n  resources_score   × weights.resources   +\n  soft_skills_score × weights.soft_skills\n) × 100\n```" +
                "\n\n**Hard disqualification rules** (configured per job):" +
                "\n- `required_skills_must_match`: candidates missing any required skill → auto-rejected" +
                "\n- `min_experience_required`: candidates below minimum years → auto-rejected" +
                "\n\nResults are persisted on each application document and returned as a ranked shortlist. " +
                "Re-running screening overwrites previous results. " +
                "\n\n**Required role:** `recruiter` (must own the job)",
            security: [{ BearerAuth: [] }],
            parameters: [
                {
                    name: "jobId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "Job MongoDB ObjectId",
                    example: "661f1b2c3d4e5f6a7b8c9d0e"
                }
            ],
            responses: {
                "200": {
                    description: "Screening complete — ranked shortlist returned",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    data: {
                                        type: "array",
                                        items: { $ref: "#/components/schemas/ShortlistEntry" },
                                        description: "Candidates sorted by final_score descending. Disqualified candidates are excluded."
                                    }
                                }
                            }
                        }
                    }
                },
                "200 (no candidates)": {
                    description: "No eligible applications found for this job"
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": {
                    description: "Job not found or you do not own it",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Job not found or you do not have permission to screen it" }
                        }
                    }
                },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/jobs/{jobId}/shortlist": {
        get: {
            tags: ["Screening"],
            summary: "Get ranked shortlist for a job",
            description:
                "Returns the persisted ranked shortlist from the last screening run. " +
                "Results are sorted by `final_score` descending. " +
                "Tie-break: earlier `appliedAt` timestamp wins (earlier applicant = higher rank). " +
                "\n\n**limit** parameter controls how many candidates to return (10 or 20). " +
                "Defaults to 10 if not provided. " +
                "\n\n**Required role:** `recruiter` (must own the job)",
            security: [{ BearerAuth: [] }],
            parameters: [
                {
                    name: "jobId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "Job MongoDB ObjectId",
                    example: "661f1b2c3d4e5f6a7b8c9d0e"
                },
                {
                    name: "limit",
                    in: "query",
                    required: false,
                    schema: { type: "integer", enum: [10, 20], default: 10 },
                    description: "Number of top candidates to return. Must be 10 or 20. Defaults to 10.",
                    example: 20
                }
            ],
            responses: {
                "200": {
                    description: "Ranked shortlist",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    data: {
                                        type: "array",
                                        items: { $ref: "#/components/schemas/ShortlistEntry" }
                                    }
                                }
                            }
                        }
                    }
                },
                "400": {
                    description: "Invalid limit value",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Invalid limit. Must be 10 or 20." }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    }
};
