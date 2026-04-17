/**
 * Applications module — OpenAPI schemas and path definitions.
 *
 * Endpoints:
 *   POST  /api/v1/applications/:jobId              — applicant submits application
 *   GET   /api/v1/applications/my                  — applicant views their own applications
 *   GET   /api/v1/applications/:applicationId      — get single application (applicant or recruiter)
 *   GET   /api/v1/applications/job/:jobId          — recruiter views all applications for a job
 *   PATCH /api/v1/applications/:applicationId/status — recruiter updates application status
 */

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const applicationSchemas = {

    ApplicationStatus: {
        type: "string",
        enum: ["pending", "reviewed", "shortlisted", "rejected", "hired"],
        description:
            "Lifecycle of an application: " +
            "`pending` (just submitted) → `reviewed` (recruiter opened it) → " +
            "`shortlisted` (AI screening passed) → `rejected` or `hired`"
    },

    ScreeningResultSummary: {
        type: "object",
        description: "Populated after AI screening is triggered by the recruiter",
        properties: {
            rank: {
                type: "integer",
                nullable: true,
                description: "1-based rank among shortlisted candidates. null if disqualified.",
                example: 2
            },
            final_score: {
                type: "number",
                description: "Weighted average score 0–100",
                example: 78.5
            },
            dimension_breakdown: {
                type: "object",
                description: "Per-dimension scores (each 0.0–1.0)",
                properties: {
                    skills:      { type: "number", example: 0.82 },
                    experience:  { type: "number", example: 1.0 },
                    education:   { type: "number", example: 0.75 },
                    resources:   { type: "number", example: 1.0 },
                    soft_skills: { type: "number", example: 0.65 }
                }
            },
            strengths:      { type: "array", items: { type: "string" }, example: ["Strong Python proficiency", "Meets experience requirement"] },
            gaps:           { type: "array", items: { type: "string" }, example: ["SQL experience below intermediate level"] },
            recommendation: { type: "string", example: "Strong candidate for the mid-level role. Recommended for interview." },
            screened_at:    { type: "string", format: "date-time" },
            ai_unavailable: {
                type: "boolean",
                description: "Present and true only when AI was unavailable — fallback scores were used",
                example: true
            }
        }
    },

    // Applicant follow-up view — minimal job info + screening summary
    ApplicationMyView: {
        type: "object",
        properties: {
            _id:         { type: "string", example: "661f1b2c3d4e5f6a7b8c9d0e" },
            status:      { $ref: "#/components/schemas/ApplicationStatus" },
            appliedAt:   { type: "string", format: "date-time" },
            updatedAt:   { type: "string", format: "date-time" },
            coverLetter: { type: "string", description: "Cover letter text (optional)", example: "I am excited to apply..." },
            screening_result: {
                type: "object",
                description: "Screening summary — only rank, score, and recommendation (not full breakdown)",
                properties: {
                    rank:           { type: "integer", nullable: true, example: 2 },
                    final_score:    { type: "number", example: 78.5 },
                    recommendation: { type: "string", example: "Strong candidate for the role." },
                    screened_at:    { type: "string", format: "date-time" }
                }
            },
            job: {
                type: "object",
                description: "Minimal job info for follow-up context",
                properties: {
                    _id:             { type: "string" },
                    title:           { type: "string", example: "Software Tools Engineer" },
                    seniority_level: { type: "string", example: "mid" },
                    employment_type: { type: "string", example: "full_time" },
                    company: {
                        type: "object",
                        properties: {
                            name:     { type: "string", example: "Zipline" },
                            location: { type: "object", properties: { city: { type: "string" }, country: { type: "string" } } }
                        }
                    },
                    domain:           { type: "object", properties: { primary: { type: "string", example: "internal_tools" } } },
                    "metadata.status":{ type: "string", example: "published" },
                    "description.summary": { type: "string", example: "Build and maintain internal annotation tools." }
                }
            }
        }
    },

    // Single application detail view (applicant or recruiter)
    ApplicationDetail: {
        type: "object",
        properties: {
            _id:              { type: "string", example: "661f1b2c3d4e5f6a7b8c9d0e" },
            applicantId:      { type: "string", example: "661f1b2c3d4e5f6a7b8c9d0f" },
            jobId:            { type: "string", example: "661f1b2c3d4e5f6a7b8c9d10" },
            status:           { $ref: "#/components/schemas/ApplicationStatus" },
            appliedAt:        { type: "string", format: "date-time" },
            updatedAt:        { type: "string", format: "date-time" },
            coverLetter:      { type: "string", description: "Optional cover letter", example: "I am excited to apply..." },
            screening_result: { $ref: "#/components/schemas/ScreeningResultSummary" },
            job: {
                type: "object",
                description: "Minimal job context",
                properties: {
                    _id:             { type: "string" },
                    title:           { type: "string", example: "Software Tools Engineer" },
                    seniority_level: { type: "string", example: "mid" },
                    employment_type: { type: "string", example: "full_time" },
                    company:         { type: "object" },
                    "metadata.status": { type: "string", example: "published" }
                }
            }
        }
    }
};

// ─── Paths ────────────────────────────────────────────────────────────────────

export const applicationPaths = {

    "/api/v1/applications/{jobId}": {
        post: {
            tags: ["Applications"],
            summary: "Submit an application to a job",
            description:
                "Submits an application for the authenticated applicant to the specified job. " +
                "Requirements before applying: " +
                "1. Applicant must have a saved profile with a CV uploaded. " +
                "2. The job must be in `published` status. " +
                "3. Applicant cannot apply to the same job twice. " +
                "\n\nThe CV URL and raw text are snapshotted at submission time for AI screening. " +
                "\n\n**Required role:** `applicant`",
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
            requestBody: {
                required: false,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                coverLetter: {
                                    type: "string",
                                    description: "Optional cover letter text",
                                    example: "I am excited to apply for this role because..."
                                }
                            }
                        }
                    }
                }
            },
            responses: {
                "201": {
                    description: "Application submitted successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    data: { $ref: "#/components/schemas/ApplicationDetail" }
                                }
                            }
                        }
                    }
                },
                "400": {
                    description: "Job not published, profile incomplete, or CV missing",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            examples: {
                                noCV: { summary: "No CV uploaded", value: { success: false, message: "No CV found on your profile. Please upload your CV before applying." } },
                                notPublished: { summary: "Job not accepting applications", value: { success: false, message: "This job is not accepting applications" } }
                            }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "404": {
                    description: "Job not found",
                    content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, message: "Job not found" } } }
                },
                "409": {
                    description: "Already applied to this job",
                    content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example: { success: false, message: "You have already applied to this job" } } }
                },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/applications/my": {
        get: {
            tags: ["Applications"],
            summary: "Get own applications (applicant follow-up view)",
            description:
                "Returns all applications submitted by the authenticated applicant. " +
                "Each entry includes application status, screening result summary (rank + score), " +
                "and minimal job info. Sorted by most recent first. " +
                "\n\n**Required role:** `applicant`",
            security: [{ BearerAuth: [] }],
            responses: {
                "200": {
                    description: "List of applicant's applications",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    data: { type: "array", items: { $ref: "#/components/schemas/ApplicationMyView" } }
                                }
                            }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/applications/{applicationId}": {
        get: {
            tags: ["Applications"],
            summary: "Get a single application by ID",
            description:
                "Returns full application details including screening result. " +
                "\n\n**Access rules:**" +
                "\n- Applicants can only view their own application" +
                "\n- Recruiters can only view applications for jobs they own" +
                "\n\n**Required role:** any authenticated user",
            security: [{ BearerAuth: [] }],
            parameters: [
                {
                    name: "applicationId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "Application MongoDB ObjectId",
                    example: "661f1b2c3d4e5f6a7b8c9d0e"
                }
            ],
            responses: {
                "200": {
                    description: "Application found",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    data: { $ref: "#/components/schemas/ApplicationDetail" }
                                }
                            }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "404": { $ref: "#/components/responses/NotFound" },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/applications/job/{jobId}": {
        get: {
            tags: ["Applications"],
            summary: "Get all applications for a job (recruiter view)",
            description:
                "Returns all applications submitted for the specified job. " +
                "Only accessible by the recruiter who owns the job. " +
                "Includes applicant profile data (CV public ID excluded). " +
                "\n\n**Required role:** `recruiter`",
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
                    description: "List of applications for the job",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    data: { type: "array", items: { $ref: "#/components/schemas/ApplicationDetail" } }
                                }
                            }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/applications/{applicationId}/status": {
        patch: {
            tags: ["Applications"],
            summary: "Update application status",
            description:
                "Manually updates the status of an application. " +
                "Note: `shortlisted` and `rejected` are also set automatically by AI screening. " +
                "\n\nAllowed values: `pending`, `reviewed`, `shortlisted`, `rejected`, `hired`" +
                "\n\n**Required role:** `recruiter`",
            security: [{ BearerAuth: [] }],
            parameters: [
                {
                    name: "applicationId",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "Application MongoDB ObjectId",
                    example: "661f1b2c3d4e5f6a7b8c9d0e"
                }
            ],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["status"],
                            properties: {
                                status: { $ref: "#/components/schemas/ApplicationStatus" }
                            }
                        },
                        example: { status: "reviewed" }
                    }
                }
            },
            responses: {
                "200": {
                    description: "Status updated",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: { success: { type: "boolean", example: true } }
                            }
                        }
                    }
                },
                "400": {
                    description: "Invalid status value",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Invalid status. Must be one of: pending, reviewed, shortlisted, rejected, hired" }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "404": { $ref: "#/components/responses/NotFound" },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    }
};
