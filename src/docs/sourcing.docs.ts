
/**
 * Sourcing module — OpenAPI schemas and path definitions.
 * 
 * This module is dedicated to recruiters for managing candidate pipelines
 * and bulk importing data from external sources.
 */

export const sourcingSchemas = {

    CandidateProcessResult: {
        type: "object",
        properties: {
            row_number: { type: "integer", example: 2 },
            first_name: { type: "string", example: "John" },
            last_name: { type: "string", example: "Doe" },
            email: { type: "string", example: "john@example.com" },
            success: { type: "boolean", example: true },
            applicantId: { type: "string", example: "661f1b2c3d4e5f6a7b8c9d10" },
            applicationId: { type: "string", example: "661f1b2c3d4e5f6a7b8c9d11" },
            error: {
                type: "object",
                properties: {
                    stage: { type: "string", enum: ["validation", "fetch", "parse", "save"] },
                    message: { type: "string", example: "Missing required fields" }
                }
            }
        }
    },

    SourcingBulkUploadResponse: {
        type: "object",
        properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Bulk import completed" },
            data: {
                type: "object",
                properties: {
                    imported: { type: "integer" },
                    failed: { type: "integer" },
                    total: { type: "integer" },
                    jobId: { type: "string" },
                    results: {
                        type: "array",
                        items: { $ref: "#/components/schemas/CandidateProcessResult" }
                    }
                }
            }
        }
    },

    SourcingColumnMapping: {
        type: "object",
        description: "JSON string mapping spreadsheet headers to system fields.",
        properties: {
            first_name: { type: "string", description: "Column name for first name (Required)" },
            last_name: { type: "string", description: "Column name for last name (Required)" },
            email: { type: "string", description: "Column name for email (Required)" },
            resume_url: { type: "string", description: "Column name for resume PDF link (Optional)" },
            headline: { type: "string", description: "Column name for professional headline (Optional)" },
            bio: { type: "string", description: "Column name for bio (Optional)" },
            location: { type: "string", description: "Column name for location (Optional)" },
            linkedin: { type: "string", description: "Column name for LinkedIn URL (Optional)" },
            github: { type: "string", description: "Column name for GitHub URL (Optional)" },
            portfolio: { type: "string", description: "Column name for Portfolio/Website URL (Optional)" }
        },
        example: {
            first_name: "Candidate First Name",
            last_name: "Candidate Last Name",
            email: "Email Address",
            resume_url: "CV Link",
            location: "Current City"
        }
    }
};

export const sourcingPaths = {

    "/api/v1/sourcing/bulk-import": {
        post: {
            tags: ["Sourcing"],
            summary: "Bulk import candidates (Hackathon Talent Profile Schema)",
            description:
                "Uploads a spreadsheet and maps it to the Umurava Talent Profile Schema. " +
                "\n\n**Frontend Integration:**" +
                "\n1. Send a `multipart/form-data` request." +
                "\n2. `columnMappingJson` must be a JSON string like: `{\"first_name\": \"Excel Col A\", \"email\": \"Excel Col B\", ...}`." +
                "\n3. `skipInvalidRows`: if true, the import continues even if individual rows fail." +
                "\n\n**Schema Enforcement:**" +
                "\nThe system strictly enforces the Umurava Hackathon Talent Profile specification, ensuring all candidates are ready for AI Ranking.",
            security: [{ BearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "multipart/form-data": {
                        schema: {
                            type: "object",
                            required: ["jobId", "file", "columnMappingJson"],
                            properties: {
                                jobId: { type: "string", example: "661f1b2c3d4e5f6a7b8c9d10" },
                                file: { type: "string", format: "binary" },
                                columnMappingJson: { type: "string", description: "Stringified SourcingColumnMapping object" },
                                skipInvalidRows: { type: "boolean", default: false }
                            }
                        }
                    }
                }
            },
            responses: {
                "201": {
                    description: "Import successful — all candidates created and linked to the job.",
                    content: { "application/json": { schema: { $ref: "#/components/schemas/SourcingBulkUploadResponse" } } }
                },
                "200": {
                    description: "Import completed with partial failures. Check the results array for details.",
                    content: { "application/json": { schema: { $ref: "#/components/schemas/SourcingBulkUploadResponse" } } }
                },
                "400": {
                    description: "Missing required parameters or invalid file type.",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Missing required parameters (jobId, file, columnMappingJson)" }
                        }
                    }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "403": {
                    description: "The job was not found or you do not have permission to import candidates to it.",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Job not found or unauthorized" }
                        }
                    }
                },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/sourcing/template": {
        get: {
            tags: ["Sourcing"],
            summary: "Get CSV template for bulk import",
            description: "Downloads a clean CSV template that recruiters can use to prepare their data for import.",
            security: [{ BearerAuth: [] }],
            responses: {
                "200": {
                    description: "CSV file content",
                    content: { "text/csv": { schema: { type: "string" } } }
                },
                "401": { $ref: "#/components/responses/Unauthorized" },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    }
};
