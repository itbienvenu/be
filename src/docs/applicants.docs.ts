/**
 * Applicants module — OpenAPI schemas and path definitions.
 *
 * Two-step profile creation flow:
 *   Step 1: POST /api/v1/applicants/upload-cv   — upload PDF, AI extracts structured profile
 *   Step 2: POST /api/v1/applicants/save-profile — review and confirm the extracted profile
 *
 *
 * Other endpoints:
 *   GET   /api/v1/applicants/profile  — get own profile
 *   PATCH /api/v1/applicants/profile  — partially update profile fields
 *
 * All endpoints require: Authorization: Bearer <token>  (any authenticated user)
 */

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const applicantSchemas = {

    ApplicantSkill: {
        type: "object",
        required: ["name", "level"],
        properties: {
            name: { type: "string", example: "Python" },
            level: { type: "string", enum: ["Beginner", "Intermediate", "Advanced", "Expert"], example: "Advanced" },
            years_of_experience: { type: "number", description: "Years of experience with this skill (optional)", example: 3 }
        }
    },

    ApplicantLanguage: {
        type: "object",
        required: ["name", "proficiency"],
        properties: {
            name: { type: "string", example: "English" },
            proficiency: { type: "string", enum: ["Beginner", "Intermediate", "Advanced", "Native"], example: "Native" }
        }
    },

    ApplicantExperience: {
        type: "object",
        required: ["company", "role", "start_date"],
        properties: {
            company: { type: "string", example: "Zipline" },
            role: { type: "string", example: "Software Engineer" },
            start_date: { type: "string", format: "date", example: "2022-01-01" },
            work_type: { type: "string", enum: ["Full-time", "Part-time", "Freelance"], example: "Full-time" },
            end_date: { type: "string", format: "date", description: "Omit or leave null if currently employed here", example: "2024-06-30" },
            location: { type: "string", description: "Optional work location", example: "Kigali, Rwanda" },
            description: { type: "string", description: "Role description and key achievements (optional)" },
            technologies: { type: "array", items: { type: "string" }, description: "Technologies used (optional)", example: ["Python", "PostgreSQL"] },
            is_current: { type: "boolean", description: "Set to true if this is the current role (optional)", example: false }
        }
    },

    ApplicantEducation: {
        type: "object",
        required: ["institution", "degree", "start_date"],
        properties: {
            institution: { type: "string", example: "University of Rwanda" },
            degree: { type: "string", example: "Bachelor of Science" },
            major: { type: "string", description: "Major or specialisation (optional)", example: "Computer Science" },
            location: { type: "string", description: "Institution location (optional)", example: "Kigali, Rwanda" },
            field_of_study: { type: "string", description: "Field of study (optional)", example: "Software Engineering" },
            start_date: { type: "string", format: "date", example: "2018-09-01" },
            end_date: { type: "string", format: "date", description: "Graduation date (optional if ongoing)", example: "2022-06-30" }
        }
    },

    ApplicantCertification: {
        type: "object",
        required: ["name", "issuer"],
        properties: {
            name: { type: "string", example: "AWS Certified Developer" },
            issuer: { type: "string", example: "Amazon Web Services" },
            issue_date: { type: "string", format: "date", description: "Date issued (optional)", example: "2023-03-15" }
        }
    },

    ApplicantProject: {
        type: "object",
        required: ["name"],
        properties: {
            name: { type: "string", example: "AI Resume Parser" },
            description: { type: "string", description: "Project description (optional)" },
            technologies: { type: "array", items: { type: "string" }, example: ["TypeScript", "Gemini API"] },
            link: { type: "string", format: "uri", nullable: true, description: "Project URL (optional)", example: "https://github.com/user/project" },
            start_date: { type: "string", format: "date", description: "Optional", example: "2024-01-01" },
            end_date: { type: "string", format: "date", description: "Optional", example: "2024-03-01" }
        }
    },

    ApplicantProfile: {
        type: "object",
        required: ["first_name", "last_name", "email", "headline", "location", "skills", "experience", "education", "projects", "availability"],
        properties: {
            first_name: { type: "string", example: "Alice" },
            last_name: { type: "string", example: "Uwimana" },
            email: { type: "string", format: "email", example: "alice@example.com" },
            headline: { type: "string", description: "Short professional title", example: "Full-Stack Software Engineer" },
            bio: { type: "string", description: "Professional summary (optional)", example: "3 years building scalable APIs and data pipelines." },
            location: { type: "string", example: "Kigali, Rwanda" },
            gender: { type: "string", enum: ["Male", "Female", "Other"], description: "Optional" },
            nationality: { type: "string", description: "Optional", example: "Rwandan" },
            date_of_birth: { type: "string", format: "date", description: "Optional", example: "1998-05-20" },
            profile_picture: { type: "string", format: "uri", nullable: true, description: "Profile photo URL (optional)" },
            skills: { type: "array", items: { $ref: "#/components/schemas/ApplicantSkill" } },
            languages: { type: "array", items: { $ref: "#/components/schemas/ApplicantLanguage" } },
            experience: { type: "array", items: { $ref: "#/components/schemas/ApplicantExperience" } },
            education: { type: "array", items: { $ref: "#/components/schemas/ApplicantEducation" } },
            certifications: {
                type: "array",
                items: { $ref: "#/components/schemas/ApplicantCertification" },
                description: "Optional list of certifications"
            },
            projects: { type: "array", items: { $ref: "#/components/schemas/ApplicantProject" } },
            availability: {
                type: "object",
                properties: {
                    status: { type: "string", enum: ["Available", "Not Available", "Open to Opportunities"], example: "Open to Opportunities" },
                    type: { type: "string", enum: ["Full-time", "Part-time", "Freelance"], example: "Full-time" },
                    start_date: { type: "string", format: "date", description: "Earliest available start date (optional)" }
                }
            },
            social_links: {
                type: "object",
                description: "Optional social media links",
                properties: {
                    linkedin: { type: "string", format: "uri", nullable: true, example: "https://linkedin.com/in/alice" },
                    github: { type: "string", format: "uri", nullable: true, example: "https://github.com/alice" },
                    twitter: { type: "string", format: "uri", nullable: true, example: null }
                }
            },
            preferences: {
                type: "object",
                description: "Optional job preferences",
                properties: {
                    job_type: { type: "string", enum: ["Remote", "On-site", "Hybrid"] },
                    work_mode: { type: "array", items: { type: "string", enum: ["remote", "on-site", "hybrid"] } },
                    expected_salary: {
                        type: "object",
                        properties: {
                            min: { type: "number", example: 1500 },
                            max: { type: "number", example: 3000 },
                            currency: { type: "string", example: "USD" }
                        }
                    }
                }
            },
            area_of_expertise: {
                type: "array",
                description: "Optional domain expertise summary",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string", example: "Backend Development" },
                        experience_years: { type: "number", example: 3 }
                    }
                }
            }
        }
    },

    ApplicantFullResponse: {
        type: "object",
        required: ["_id", "userId", "cvUrl", "profile", "createdAt", "updatedAt"],
        properties: {
            _id: { type: "string", example: "661f1b2c3d4e5f6a7b8c9d0e" },
            userId: { type: "string", example: "661f1b2c3d4e5f6a7b8c9d0f" },
            cvUrl: { type: "string", format: "uri", description: "Cloudinary URL of the uploaded CV PDF", example: "https://res.cloudinary.com/..." },
            profile: { $ref: "#/components/schemas/ApplicantProfile" },
            createdAt: { type: "string", format: "date-time", example: "2024-04-20T10:00:00Z" },
            updatedAt: { type: "string", format: "date-time", example: "2024-04-21T12:00:00Z" },
        }
    },

    CoverLetterResponse: {
        type: "object",
        properties: {
            subject: { type: "string", example: "Application for Software Engineer Role" },
            content: { type: "string", example: "Dear Hiring Manager,\n\nI am writing to express my interest..." },
            highlights: { type: "array", items: { type: "string" }, example: ["Focused on 3 years of React experience", "Emphasized leadership skills"] },
            tips: { type: "string", example: "Remember to mention the specific project you worked on at Zipline." }
        }
    }
};

// ─── Paths ────────────────────────────────────────────────────────────────────

export const applicantPaths = {

    "/api/v1/applicants/upload-cv": {
        post: {
            tags: ["Applicants"],
            summary: "Step 1 — Upload CV PDF and extract profile",
            description:
                "Uploads a PDF CV (max 5MB), stores it on Cloudinary, extracts the raw text, " +
                "and sends it to Gemini AI which returns a structured profile JSON. " +
                "The extracted profile is returned for the applicant to review — **it is not saved yet**. " +
                "Call `POST /save-profile` with the reviewed data to persist it. " +
                "\n\n**Required role:** any authenticated user",
            security: [{ BearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "multipart/form-data": {
                        schema: {
                            type: "object",
                            required: ["cv"],
                            properties: {
                                cv: {
                                    type: "string",
                                    format: "binary",
                                    description: "PDF file only, maximum 5MB"
                                }
                            }
                        }
                    }
                }
            },
            responses: {
                "200": {
                    description: "CV parsed — review the extracted profile before saving",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "CV parsed successfully. Please review and confirm the details." },
                                    data: {
                                        type: "object",
                                        properties: {
                                            cvUrl: { type: "string", format: "uri", description: "Cloudinary URL of the stored PDF" },
                                            profile: { $ref: "#/components/schemas/ApplicantProfile" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                "400": {
                    description: "No file uploaded or file is not a PDF",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "No CV file uploaded" }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/applicants/save-profile": {
        post: {
            tags: ["Applicants"],
            summary: "Step 2 — Save reviewed profile",
            description:
                "Persists the applicant profile to the database. " +
                "Send the full profile JSON returned from `POST /upload-cv` (optionally edited by the applicant). " +
                "This is an upsert — calling it again replaces the existing profile. " +
                "\n\n**Required role:** any authenticated user",
            security: [{ BearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/ApplicantProfile" }
                    }
                }
            },
            responses: {
                "200": {
                    description: "Profile saved successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Profile saved successfully" },
                                    data: { $ref: "#/components/schemas/ApplicantFullResponse" }
                                }
                            }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/applicants/profile": {
        get: {
            tags: ["Applicants"],
            summary: "Get own applicant profile",
            description:
                "Returns the authenticated applicant's full profile including CV URL and user details. " +
                "Returns 404 if the profile has not been created yet (upload CV first). " +
                "\n\n**Required role:** any authenticated user",
            security: [{ BearerAuth: [] }],
            responses: {
                "200": {
                    description: "Profile retrieved",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    data: { $ref: "#/components/schemas/ApplicantFullResponse" }
                                }
                            }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "404": {
                    description: "Profile not found — applicant has not uploaded a CV yet",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Applicant profile not found" }
                        }
                    }
                },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        },

        patch: {
            tags: ["Applicants"],
            summary: "Partially update profile fields",
            description:
                "Updates specific fields of the applicant profile using dot-notation paths. " +
                "Only the fields provided in the request body are updated — other fields are untouched. " +
                "Useful for updating availability, adding a new skill, or editing a specific experience entry. " +
                "\n\n**Required role:** any authenticated user",
            security: [{ BearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            description: "Any subset of ApplicantProfile fields to update",
                            example: {
                                "profile.headline": "Senior Full-Stack Engineer",
                                "profile.availability.status": "Available"
                            }
                        }
                    }
                }
            },
            responses: {
                "200": {
                    description: "Profile updated successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Profile updated successfully" }
                                }
                            }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "404": {
                    description: "Profile not found",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Profile not found" }
                        }
                    }
                },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/applicants/generate-cover-letter/{jobId}": {
        post: {
            tags: ["Applicants"],
            summary: "AI-Powered Cover Letter Generation",
            description:
                "Generates a personalized cover letter based on the applicant's CV and a provided Job. " +
                "The CV can be provided as raw text, an uploaded PDF file, or it will be automatically fetched from the applicant's saved profile. " +
                "\n\n**Required role:** any authenticated user",
            security: [{ BearerAuth: [] }],
            parameters: [
                {
                    name: "jobId",
                    in: "path",
                    required: true,
                    description: "The ID of the job to write the cover letter for",
                    schema: { type: "string" }
                }
            ],
            requestBody: {
                content: {
                    "multipart/form-data": {
                        schema: {
                            type: "object",
                            properties: {
                                cvText: { type: "string", description: "Optional: Raw CV text if not using file or saved profile" },
                                instructions: { type: "string", description: "Optional: Custom instructions for the AI" },
                                cvFile: { type: "string", format: "binary", description: "Optional: A PDF CV to use for this specific letter" }
                            }
                        }
                    },
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                cvText: { type: "string" },
                                instructions: { type: "string" }
                            }
                        }
                    }
                }
            },
            responses: {
                "200": {
                    description: "Cover letter generated successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Cover letter generated successfully" },
                                    data: { $ref: "#/components/schemas/CoverLetterResponse" }
                                }
                            }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    }
};
