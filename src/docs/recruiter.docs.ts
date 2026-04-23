/**
 * Recruiters module — OpenAPI schemas and path definitions.
 *
 * Endpoints:
 *   POST /api/v1/recruiters/profile   — create or update company profile
 *   GET  /api/v1/recruiters/profile   — get own company profile
 *
 * All endpoints require: Authorization: Bearer <token>  (role: recruiter)
 */

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const recruiterSchemas = {

    RecruiterLocation: {
        type: "object",
        required: ["city", "country"],
        properties: {
            address: {
                type: "string",
                description: "Street address (optional)",
                example: "KG 123 St"
            },
            city: {
                type: "string",
                description: "City name",
                example: "Kigali"
            },
            country: {
                type: "string",
                description: "Country name",
                example: "Rwanda"
            }
        }
    },

    RecruiterProfileRequest: {
        type: "object",
        required: ["company_name", "industry", "location"],
        properties: {
            company_name: {
                type: "string",
                minLength: 2,
                description: "Official company name",
                example: "Zipline Rwanda"
            },
            industry: {
                type: "string",
                description: "Industry or sector the company operates in",
                example: "Healthcare Logistics"
            },
            website: {
                type: "string",
                format: "uri",
                nullable: true,
                description: "Company website URL (optional)",
                example: "https://flyzipline.com"
            },
            location: {
                $ref: "#/components/schemas/RecruiterLocation"
            },
            bio: {
                type: "string",
                maxLength: 1000,
                description: "Short company description shown to applicants (optional, max 1000 chars)",
                example: "Zipline is a medical drone delivery company operating across Africa."
            },
            company_logo: {
                type: "string",
                format: "uri",
                nullable: true,
                description: "URL of the company logo image (optional)",
                example: "https://cdn.example.com/logos/zipline.png"
            },
            social_links: {
                type: "object",
                description: "Company social media links (all optional)",
                properties: {
                    linkedin: {
                        type: "string",
                        format: "uri",
                        nullable: true,
                        example: "https://linkedin.com/company/zipline"
                    },
                    twitter: {
                        type: "string",
                        format: "uri",
                        nullable: true,
                        example: "https://twitter.com/flyzipline"
                    }
                }
            }
        }
    },

    RecruiterProfileResponse: {
        type: "object",
        required: ["success", "data"],
        properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Recruiter profile saved successfully" },
            data: {
                type: "object",
                required: ["_id", "userId", "profile"],
                properties: {
                    _id: {
                        type: "string",
                        description: "MongoDB ObjectId of the recruiter document",
                        example: "661f1b2c3d4e5f6a7b8c9d0e"
                    },
                    userId: {
                        type: "string",
                        description: "MongoDB ObjectId of the linked user account",
                        example: "661f1b2c3d4e5f6a7b8c9d0f"
                    },
                    profile: {
                        $ref: "#/components/schemas/RecruiterProfileRequest"
                    },
                    user_details: {
                        type: "object",
                        description: "Basic info from the linked user account",
                        properties: {
                            name:  { type: "string", example: "Bob Mugisha" },
                            email: { type: "string", format: "email", example: "bob@zipline.com" },
                            role:  { type: "string", example: "recruiter" }
                        }
                    },
                    createdAt: {
                        type: "string",
                        format: "date-time",
                        description: "Profile creation timestamp",
                        example: "2026-04-01T10:00:00.000Z"
                    },
                    updatedAt: {
                        type: "string",
                        format: "date-time",
                        description: "Last update timestamp",
                        example: "2026-04-17T14:30:00.000Z"
                    }
                }
            }
        }
    },

    RecruiterAnalytics: {
        type: "object",
        required: ["success", "data"],
        properties: {
            success: { type: "boolean", example: true },
            data: {
                type: "object",
                required: ["totalJobs", "pending", "shortlisted", "hired", "history"],
                properties: {
                    totalJobs: { type: "integer", example: 12, description: "Total number of jobs created by the recruiter" },
                    pending: { type: "integer", example: 45, description: "Number of pending applications" },
                    shortlisted: { type: "integer", example: 10, description: "Number of shortlisted candidates" },
                    hired: { type: "integer", example: 2, description: "Number of hired candidates" },
                    history: {
                        type: "array",
                        description: "Last 5 jobs created by the recruiter",
                        items: {
                            type: "object",
                            properties: {
                                _id: { type: "string", example: "661f1b2c3d4e5f6a7b8c9d0e" },
                                title: { type: "string", example: "Senior Backend Engineer" },
                                createdAt: { type: "string", format: "date-time" },
                                metadata: {
                                    type: "object",
                                    properties: {
                                        status: { type: "string", example: "published" }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

// ─── Paths ────────────────────────────────────────────────────────────────────

export const recruiterPaths = {

    "/api/v1/recruiters/profile": {

        post: {
            tags: ["Recruiters"],
            summary: "Create or update company profile",
            description:
                "Creates the recruiter's company profile if it doesn't exist, or fully replaces it if it does (upsert). " +
                "Must be called before posting jobs — jobs are linked to the recruiter's profile. " +
                "\n\n**Required role:** `recruiter`",
            security: [{ BearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/RecruiterProfileRequest" },
                        example: {
                            company_name: "Zipline Rwanda",
                            industry: "Healthcare Logistics",
                            website: "https://flyzipline.com",
                            location: {
                                address: "KG 123 St",
                                city: "Kigali",
                                country: "Rwanda"
                            },
                            bio: "Zipline is a medical drone delivery company operating across Africa.",
                            company_logo: "https://cdn.example.com/logos/zipline.png",
                            social_links: {
                                linkedin: "https://linkedin.com/company/zipline",
                                twitter: "https://twitter.com/flyzipline"
                            }
                        }
                    }
                }
            },
            responses: {
                "200": {
                    description: "Profile saved successfully",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/RecruiterProfileResponse" }
                        }
                    }
                },
                "400": {
                    description: "Validation failed — required fields missing or invalid",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ValidationErrorResponse" },
                            example: {
                                success: false,
                                message: "Validation failed",
                                errors: [{ field: "location.city", message: "is required" }]
                            }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        },

        get: {
            tags: ["Recruiters"],
            summary: "Get own company profile",
            description:
                "Returns the authenticated recruiter's company profile including linked user details. " +
                "Returns 404 if the profile has not been created yet. " +
                "\n\n**Required role:** `recruiter`",
            security: [{ BearerAuth: [] }],
            responses: {
                "200": {
                    description: "Profile retrieved successfully",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/RecruiterProfileResponse" }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": { $ref: "#/components/responses/Forbidden" },
                "404": {
                    description: "Profile not found — recruiter has not created a profile yet",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Recruiter profile not found" }
                        }
                    }
                },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/recruiters/analytics": {
        get: {
            tags: ["Recruiters"],
            summary: "Get recruiter analytics",
            description: "Returns statistics about recruiter's jobs and applications (pending, shortlisted, hired) and recent activity history. \n\n**Required role:** `recruiter` ",
            security: [{ BearerAuth: [] }],
            responses: {
                "200": {
                    description: "Analytics retrieved successfully",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/RecruiterAnalytics" }
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
