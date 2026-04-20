/**
 * Jobs module — OpenAPI schemas and path definitions.
 *
 * Endpoints:
 *   POST   /api/v1/jobs                  — create job from raw description (AI-structured) [recruiter]
 *   GET    /api/v1/jobs                  — list all published jobs [public]
 *   GET    /api/v1/jobs/my-jobs          — list recruiter's own jobs [recruiter]
 *   GET    /api/v1/jobs/recruiter/:id    — get full job details with scoring config [recruiter, owner]
 *   GET    /api/v1/jobs/:id              — get single job public view [public]
 *   PATCH  /api/v1/jobs/:id              — edit a draft job [recruiter, owner]
 *   PATCH  /api/v1/jobs/:id/publish      — publish a draft job [recruiter, owner]
 *
 * Note: scoring_config and skill weights are hidden from public endpoints (Zero Trust).
 */

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const jobSchemas = {

    // Shared sub-schemas
    JobSkill: {
        type: "object",
        required: ["name", "category", "required", "weight", "level"],
        properties: {
            name:     { type: "string", example: "Python" },
            category: { type: "string", example: "programming_language" },
            required: { type: "boolean", description: "Whether this skill is mandatory for the role", example: true },
            weight:   { type: "number", minimum: 0, maximum: 1, description: "Importance weight used in scoring (0–1)", example: 0.18 },
            level:    { type: "string", enum: ["basic", "intermediate", "advanced"], example: "advanced" }
        }
    },

    JobSoftSkill: {
        type: "object",
        required: ["name"],
        properties: {
            name:   { type: "string", example: "communication" },
            weight: { type: "number", minimum: 0, maximum: 1, description: "Importance weight (optional, defaults to equal weight)", example: 0.05 }
        }
    },

    JobResource: {
        type: "object",
        required: ["name", "required"],
        properties: {
            name:     { type: "string", example: "Git" },
            required: { type: "boolean", example: true }
        }
    },

    JobScoringConfig: {
        type: "object",
        required: ["weights", "rules"],
        description: "Scoring configuration — hidden from public endpoints",
        properties: {
            weights: {
                type: "object",
                required: ["skills", "experience", "education", "resources", "soft_skills"],
                description: "Category weights for the weighted average scoring model. Must sum to 1.0.",
                properties: {
                    skills:      { type: "number", minimum: 0, maximum: 1, example: 0.5 },
                    experience:  { type: "number", minimum: 0, maximum: 1, example: 0.25 },
                    education:   { type: "number", minimum: 0, maximum: 1, example: 0.1 },
                    resources:   { type: "number", minimum: 0, maximum: 1, example: 0.05 },
                    soft_skills: { type: "number", minimum: 0, maximum: 1, example: 0.1 }
                }
            },
            rules: {
                type: "object",
                required: ["required_skills_must_match", "min_experience_required"],
                properties: {
                    required_skills_must_match: {
                        type: "boolean",
                        description: "If true, candidates missing any required skill are auto-disqualified",
                        example: true
                    },
                    min_experience_required: {
                        type: "boolean",
                        description: "If true, candidates below min_years experience are auto-disqualified",
                        example: true
                    }
                }
            }
        }
    },

    // Public job view — no scoring weights exposed
    JobPublic: {
        type: "object",
        required: ["_id", "title", "company", "description", "domain", "metadata"],
        properties: {
            _id:              { type: "string", example: "661f1b2c3d4e5f6a7b8c9d0e" },
            title:            { type: "string", example: "Software Tools Engineer" },
            employment_type:  { type: "string", enum: ["full_time", "part_time", "contract", "temporary", "internship"], example: "full_time" },
            seniority_level:  { type: "string", enum: ["junior", "mid", "senior", "lead", "manager", "director"], example: "mid" },
            company: {
                type: "object",
                properties: {
                    name:     { type: "string", example: "Zipline" },
                    location: { type: "object", properties: { city: { type: "string", example: "Kigali" }, country: { type: "string", example: "Rwanda" } } }
                }
            },
            description: {
                type: "object",
                properties: {
                    raw:     { type: "string", description: "Full original job description text" },
                    summary: { type: "string", description: "AI-generated concise summary (optional)", example: "Build and maintain internal annotation tools for ML workflows." }
                }
            },
            requirements: {
                type: "object",
                description: "Optional structured requirements",
                properties: {
                    experience: {
                        type: "object",
                        properties: {
                            min_years: { type: "number", example: 3 },
                            max_years: { type: "number", nullable: true, example: null },
                            roles:     { type: "array", items: { type: "string" } }
                        }
                    },
                    education: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                level:  { type: "string", example: "bachelor" },
                                fields: { type: "array", items: { type: "string" }, example: ["Computer Science"] }
                            }
                        }
                    },
                    certifications: { type: "array", items: { type: "string" } }
                }
            },
            skills: {
                type: "array",
                description: "Hard skills — weight field is hidden in public view",
                items: {
                    type: "object",
                    properties: {
                        name:     { type: "string", example: "Python" },
                        category: { type: "string", example: "programming_language" },
                        required: { type: "boolean", example: true },
                        level:    { type: "string", example: "advanced" }
                    }
                }
            },
            soft_skills: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string", example: "communication" }
                    }
                }
            },
            resources:        { type: "array", items: { $ref: "#/components/schemas/JobResource" } },
            domain: {
                type: "object",
                properties: {
                    primary:   { type: "string", example: "internal_tools" },
                    secondary: { type: "array", items: { type: "string" }, example: ["machine_learning"] }
                }
            },
            responsibilities: { type: "array", items: { type: "string" }, example: ["Build annotation tools"] },
            languages:        { type: "array", items: { type: "string" }, example: ["English"] },
            travel_required:  { type: "boolean", nullable: true, example: false },
            metadata: {
                type: "object",
                properties: {
                    status:     { type: "string", enum: ["draft", "published", "archived"], example: "published" },
                    created_at: { type: "string", format: "date-time" },
                    updated_at: { type: "string", format: "date-time" },
                    source:     { type: "string", example: "ai_structured" }
                }
            }
        }
    },

    // Recruiter full view — includes scoring_config and weights
    JobFull: {
        allOf: [
            { $ref: "#/components/schemas/JobPublic" },
            {
                type: "object",
                properties: {
                    scoring_config: { $ref: "#/components/schemas/JobScoringConfig" },
                    skills: {
                        type: "array",
                        description: "Full skill objects including weight (recruiter view only)",
                        items: { $ref: "#/components/schemas/JobSkill" }
                    },
                    soft_skills: {
                        type: "array",
                        items: { $ref: "#/components/schemas/JobSoftSkill" }
                    }
                }
            }
        ]
    },

    CreateJobRequest: {
        type: "object",
        required: ["description"],
        properties: {
            description: {
                type: "string",
                description:
                    "Raw job description text. The AI will parse this into a fully structured job document " +
                    "(skills, weights, scoring config, requirements, etc.). " +
                    "Provide as much detail as possible for best results.",
                example: "We are looking for a mid-level Software Tools Engineer at Zipline Kigali. " +
                    "Must have 3+ years Python experience, SQL, and REST API development. " +
                    "Nice to have: Docker, CI/CD. Bachelor's in Computer Science preferred."
            }
        }
    },

    PatchJobRequest: {
        type: "object",
        description:
            "Partial update for a draft job. Only the fields listed below can be edited. " +
            "Sensitive fields (scoring_config, recruiterId, metadata.status) are blocked. " +
            "Job must be in `draft` status to be editable.",
        properties: {
            title:            { type: "string", example: "Senior Software Tools Engineer" },
            employment_type:  { type: "string", enum: ["full_time", "part_time", "contract", "temporary", "internship"] },
            seniority_level:  { type: "string", enum: ["junior", "mid", "senior", "lead", "manager", "director"] },
            description:      { type: "object", properties: { raw: { type: "string" }, summary: { type: "string" } } },
            skills:           { type: "array", items: { $ref: "#/components/schemas/JobSkill" } },
            soft_skills:      { type: "array", items: { $ref: "#/components/schemas/JobSoftSkill" } },
            resources:        { type: "array", items: { $ref: "#/components/schemas/JobResource" } },
            responsibilities: { type: "array", items: { type: "string" } },
            requirements:     { type: "object" },
            domain:           { type: "object" },
            languages:        { type: "array", items: { type: "string" } },
            travel_required:  { type: "boolean", nullable: true }
        }
    }
};

// ─── Paths ────────────────────────────────────────────────────────────────────

export const jobPaths = {

    "/api/v1/jobs": {
        get: {
            tags: ["Jobs"],
            summary: "List all published jobs",
            description:
                "Returns all jobs with `status: published`. " +
                "Scoring weights and config are hidden — this is the applicant-facing view. " +
                "\n\n**Auth:** Not required",
            responses: {
                "200": {
                    description: "List of published jobs",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    data: { type: "array", items: { $ref: "#/components/schemas/JobPublic" } }
                                }
                            }
                        }
                    }
                },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        },

        post: {
            tags: ["Jobs"],
            summary: "Create a job from raw description (AI-structured)",
            description:
                "Sends the raw job description to Gemini AI which extracts and structures it into a full job document " +
                "including skills with weights, scoring config, requirements, and domain classification. " +
                "The job is created in `draft` status — call `PATCH /:id/publish` to make it live. " +
                "\n\n**Required role:** `recruiter`",
            security: [{ BearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/CreateJobRequest" }
                    }
                }
            },
            responses: {
                "201": {
                    description: "Job created successfully in draft status",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    data: {
                                        type: "object",
                                        properties: {
                                            acknowledged: { type: "boolean", example: true },
                                            insertedId:   { type: "string", example: "69e60b1290036afefcc801bf" }
                                        }
                                    }
                                }
                            },
                            example: {
                                success: true,
                                data: { acknowledged: true, insertedId: "69e60b1290036afefcc801bf" }
                            }
                        }
                    }
                },
                "400": {
                    description: "Description missing or AI failed to parse it",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            examples: {
                                missing_description: {
                                    summary: "Description not provided",
                                    value: { error: "Job description is required" }
                                },
                                ai_parse_failed: {
                                    summary: "AI failed to parse description",
                                    value: { error: "Failed to parse job description" }
                                }
                            }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "500": {
                    description: "Internal server error",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    error: { type: "string", example: "Failed to create job" }
                                }
                            }
                        }
                    }
                }
            }
        }
    },

    "/api/v1/jobs/my-jobs": {
        get: {
            tags: ["Jobs"],
            summary: "List recruiter's own jobs",
            description:
                "Returns all jobs posted by the authenticated recruiter (all statuses: draft, published, archived). " +
                "Includes full scoring config and weights. " +
                "\n\n**Required role:** `recruiter`",
            security: [{ BearerAuth: [] }],
            responses: {
                "200": {
                    description: "Recruiter's jobs",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    data: { type: "array", items: { $ref: "#/components/schemas/JobFull" } }
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

    "/api/v1/jobs/recruiter/{id}": {
        get: {
            tags: ["Jobs"],
            summary: "Get full job details (recruiter owner only)",
            description:
                "Returns the complete job document including scoring config and skill weights. " +
                "Only accessible by the recruiter who owns the job (Zero Trust ownership check). " +
                "\n\n**Required role:** `recruiter`",
            security: [{ BearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "Job MongoDB ObjectId",
                    example: "661f1b2c3d4e5f6a7b8c9d0e"
                }
            ],
            responses: {
                "200": {
                    description: "Full job details",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    data: { $ref: "#/components/schemas/JobFull" }
                                }
                            }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": {
                    description: "Job not found or you do not own it",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Job not found or you do not have permission to view full details" }
                        }
                    }
                },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/jobs/{id}": {
        get: {
            tags: ["Jobs"],
            summary: "Get a single job (public view)",
            description:
                "Returns a single published job by ID. Scoring weights and config are hidden. " +
                "\n\n**Auth:** Not required",
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "Job MongoDB ObjectId",
                    example: "661f1b2c3d4e5f6a7b8c9d0e"
                }
            ],
            responses: {
                "200": {
                    description: "Job found",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    data: { $ref: "#/components/schemas/JobPublic" }
                                }
                            }
                        }
                    }
                },
                "404": { $ref: "#/components/responses/NotFound" },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        },

        patch: {
            tags: ["Jobs"],
            summary: "Edit a draft job",
            description:
                "Partially updates a job that is in `draft` status. " +
                "Only the fields listed in the request schema can be changed. " +
                "Sensitive fields (scoring_config, recruiterId, metadata.status) are blocked server-side. " +
                "Returns 400 if the job is already published or archived. " +
                "\n\n**Required role:** `recruiter` (must own the job)",
            security: [{ BearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "Job MongoDB ObjectId",
                    example: "661f1b2c3d4e5f6a7b8c9d0e"
                }
            ],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/PatchJobRequest" },
                        example: {
                            title: "Senior Software Tools Engineer",
                            seniority_level: "senior"
                        }
                    }
                }
            },
            responses: {
                "200": {
                    description: "Job updated successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Job updated successfully" }
                                }
                            }
                        }
                    }
                },
                "400": {
                    description: "Job is not in draft state or invalid fields",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Job is not in draft state and cannot be edited" }
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

    "/api/v1/jobs/{id}/publish": {
        patch: {
            tags: ["Jobs"],
            summary: "Publish a draft job",
            description:
                "Transitions a job from `draft` to `published` status, making it visible to applicants. " +
                "Once published, edit the job by unpublishing it first. " +
                "\n\n**Required role:** `recruiter` (must own the job)",
            security: [{ BearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "Job MongoDB ObjectId",
                    example: "661f1b2c3d4e5f6a7b8c9d0e"
                }
            ],
            responses: {
                "200": {
                    description: "Job published successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Job published successfully" }
                                }
                            }
                        }
                    }
                },
                "400": {
                    description: "Job is not in draft state",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Job is not in draft state and cannot be published" }
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

    "/api/v1/jobs/{id}/unpublish": {
        patch: {
            tags: ["Jobs"],
            summary: "Unpublish a job (back to draft)",
            description:
                "Reverts a `published` job back to `draft` status. " +
                "Use this when you need to edit a published job — unpublish it, patch the details, then publish again. " +
                "\n\n**Required role:** `recruiter` (must own the job)",
            security: [{ BearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "Job MongoDB ObjectId",
                    example: "661f1b2c3d4e5f6a7b8c9d0e"
                }
            ],
            responses: {
                "200": {
                    description: "Job moved back to draft",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Job unpublished and moved back to draft" }
                                }
                            }
                        }
                    }
                },
                "400": {
                    description: "Job is not in published state",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Job is not in published state and cannot be unpublished" }
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

    "/api/v1/jobs/{id}/archive": {
        patch: {
            tags: ["Jobs"],
            summary: "Archive a job",
            description:
                "Moves a job to `archived` status from either `draft` or `published`. " +
                "Archived jobs are hidden from applicants and cannot be edited or published. " +
                "\n\n**Required role:** `recruiter` (must own the job)",
            security: [{ BearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "Job MongoDB ObjectId",
                    example: "661f1b2c3d4e5f6a7b8c9d0e"
                }
            ],
            responses: {
                "200": {
                    description: "Job archived successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Job archived successfully" }
                                }
                            }
                        }
                    }
                },
                "400": {
                    description: "Job is already archived",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Job is already archived" }
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
