
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
    }
};

export const sourcingPaths = {

    "/api/v1/sourcing/bulk-import": {
        post: {
            tags: ["Sourcing"],
            summary: "Bulk import candidates for a specific job",
            description:
                "Uploads a spreadsheet (Excel or CSV) containing candidate data from an external system. " +
                "For every candidate in the file, the system will: " +
                "\n1. Map spreadsheet columns to system fields using `columnMappingJson`." +
                "\n2. Fetch the resume from the `resume_url` (if provided)." +
                "\n3. Use Gemini AI to extract a full structured profile from the resume." +
                "\n4. Create a new Applicant record and **immediately link them to the provided `jobId`** by creating an Application record." +
                "\n\nThis is the fastest way for recruiters to populate a job pipeline with candidates from LinkedIn, Indeed, etc.",
            security: [{ BearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "multipart/form-data": {
                        schema: {
                            type: "object",
                            required: ["jobId", "file", "columnMappingJson"],
                            properties: {
                                jobId: { type: "string" },
                                file: { type: "string", format: "binary" },
                                columnMappingJson: { type: "string" },
                                skipInvalidRows: { type: "boolean" }
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
