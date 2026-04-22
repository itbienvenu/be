/**
 * Swagger / OpenAPI configuration.
 *
 * The base URL is read from process.env.API_BASE_URL so it works in
 * every environment (local, staging, production) without code changes.
 *
 * Docs are served at GET /api/v1/docs
 *
 * Module docs are imported individually so each module can be documented
 * and reviewed in isolation before being merged here.
 */

import swaggerJsdoc from "swagger-jsdoc";
import { authSchemas, authPaths } from "./auth.docs.js";
import { recruiterSchemas, recruiterPaths } from "./recruiter.docs.js";
import { jobSchemas, jobPaths } from "./jobs.docs.js";
import { applicantSchemas, applicantPaths } from "./applicants.docs.js";
import { applicationSchemas, applicationPaths } from "./applications.docs.js";
import { screeningSchemas, screeningPaths } from "./screening.docs.js";
import { sourcingSchemas, sourcingPaths } from "./sourcing.docs.js";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.3",
        info: {
            title: "Umurava Recruitment API",
            version: "1.0.0",
            description:
                "AI-powered recruitment platform API. " +
                "Supports job posting, applicant screening, and ranked shortlist generation using Gemini AI.",
            contact: {
                name: "Umurava Engineering",
                email: "competence@umurava.africa"
            }
        },
        servers: [
            {
                // Driven by env var — no hardcoded localhost in production
                url: process.env.API_BASE_URL ?? "http://localhost:3001",
                description: "Active server"
            }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "JWT access token obtained from POST /api/v1/auth/login"
                }
            },
            schemas: {
                // ── Shared error schemas ──────────────────────────────────
                ErrorResponse: {
                    type: "object",
                    required: ["success", "message"],
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string", example: "Descriptive error message" }
                    }
                },
                ValidationErrorResponse: {
                    type: "object",
                    required: ["success", "message", "errors"],
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string", example: "Invalid request body" },
                        errors: {
                            type: "array",
                            items: { type: "object" },
                            description: "AJV validation error details"
                        }
                    }
                },
                // ── Module schemas (merged below) ─────────────────────────
                ...authSchemas,
                ...recruiterSchemas,
                ...jobSchemas,
                ...applicantSchemas,
                ...applicationSchemas,
                ...screeningSchemas,
                ...sourcingSchemas,
            },
            responses: {
                Unauthorized: {
                    description: "Missing or invalid Bearer token",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Unauthorized: No token provided" }
                        }
                    }
                },
                Forbidden: {
                    description: "Authenticated but insufficient role or ownership",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Forbidden: Access restricted to recruiter only" }
                        }
                    }
                },
                NotFound: {
                    description: "Resource not found",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Not found" }
                        }
                    }
                },
                InternalError: {
                    description: "Unexpected server error",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Internal server error" }
                        }
                    }
                }
            }
        },
        // Merge all module paths
        paths: {
            ...authPaths,
            ...recruiterPaths,
            ...jobPaths,
            ...applicantPaths,
            ...applicationPaths,
            ...screeningPaths,
            ...sourcingPaths,
        },
        tags: [
            { name: "Auth",        description: "Registration and login" },
            { name: "Recruiters",  description: "Recruiter company profile management" },
            { name: "Jobs",        description: "Job posting, editing, and publishing" },
            { name: "Applicants",  description: "Applicant profile and CV management" },
            { name: "Applications",description: "Job applications submitted by applicants" },
            { name: "Screening",   description: "AI-powered candidate screening and ranked shortlists" },
            { name: "Sourcing",    description: "Recruiter candidate sourcing and bulk management" }
        ]
    },
    // No file scanning — all docs are imported explicitly above
    apis: []
};

export const swaggerSpec = swaggerJsdoc(options);
