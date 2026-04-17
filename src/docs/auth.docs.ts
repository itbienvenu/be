/**
 * Auth module — OpenAPI schemas and path definitions.
 *
 * Endpoints:
 *   POST /api/v1/auth/register
 *   POST /api/v1/auth/login
 */

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const authSchemas = {

    RegisterRequest: {
        type: "object",
        required: ["name", "email", "password", "role"],
        properties: {
            name: {
                type: "string",
                minLength: 3,
                maxLength: 100,
                description: "Full name of the user",
                example: "Alice Uwimana"
            },
            email: {
                type: "string",
                format: "email",
                description: "Valid email address — used as login identifier",
                example: "alice@example.com"
            },
            password: {
                type: "string",
                minLength: 8,
                maxLength: 128,
                description: "Password (min 8 characters)",
                example: "Str0ngP@ss!"
            },
            role: {
                type: "string",
                enum: ["applicant", "recruiter"],
                description: "User role — determines access level throughout the API",
                example: "applicant"
            }
        }
    },

    RegisterResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "User registered successfully" },
            data: {
                type: "object",
                required: ["name", "email", "role"],
                properties: {
                    name:  { type: "string", example: "Alice Uwimana" },
                    email: { type: "string", format: "email", example: "alice@example.com" },
                    role:  { type: "string", enum: ["applicant", "recruiter"], example: "applicant" }
                }
            }
        }
    },

    LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
            email: {
                type: "string",
                format: "email",
                description: "Registered email address",
                example: "alice@example.com"
            },
            password: {
                type: "string",
                description: "Account password",
                example: "Str0ngP@ss!"
            }
        }
    },

    LoginResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "User logged in successfully" },
            data: {
                type: "object",
                required: ["accessToken", "refreshToken", "user"],
                properties: {
                    accessToken: {
                        type: "string",
                        description: "Short-lived JWT access token (1 hour). Use as 'Authorization: Bearer <token>' on protected endpoints.",
                        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    },
                    refreshToken: {
                        type: "string",
                        description: "Long-lived refresh token (7 days). Store securely and use to obtain a new access token via POST /api/v1/auth/refresh.",
                        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    },
                    user: {
                        type: "object",
                        required: ["_id", "name", "email", "role"],
                        properties: {
                            _id:   { type: "string", description: "MongoDB ObjectId of the user", example: "661f1b2c3d4e5f6a7b8c9d0e" },
                            name:  { type: "string", example: "Alice Uwimana" },
                            email: { type: "string", format: "email", example: "alice@example.com" },
                            role:  { type: "string", enum: ["applicant", "recruiter"], example: "applicant" }
                        }
                    }
                }
            }
        }
    },

    RefreshTokenRequest: {
        type: "object",
        required: ["refreshToken"],
        properties: {
            refreshToken: {
                type: "string",
                description: "The refresh token received from POST /api/v1/auth/login",
                example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            }
        }
    },

    RefreshTokenResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Access token refreshed" },
            data: {
                type: "object",
                required: ["accessToken"],
                properties: {
                    accessToken: {
                        type: "string",
                        description: "New short-lived JWT access token (1 hour)",
                        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    }
                }
            }
        }
    }
};

// ─── Paths ────────────────────────────────────────────────────────────────────

export const authPaths = {

    "/api/v1/auth/register": {
        post: {
            tags: ["Auth"],
            summary: "Register a new user",
            description:
                "Creates a new user account. " +
                "The `role` field determines whether the user is an **applicant** (job seeker) " +
                "or a **recruiter** (hiring manager). Role cannot be changed after registration.",
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/RegisterRequest" },
                        example: {
                            name: "Alice Uwimana",
                            email: "alice@example.com",
                            password: "Str0ngP@ss!",
                            role: "applicant"
                        }
                    }
                }
            },
            responses: {
                "201": {
                    description: "User registered successfully",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/RegisterResponse" }
                        }
                    }
                },
                "400": {
                    description: "Validation failed — missing or invalid fields",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ValidationErrorResponse" },
                            example: {
                                success: false,
                                message: "Invalid request body",
                                errors: [{ field: "role", message: "must be one of: applicant, recruiter" }]
                            }
                        }
                    }
                },
                "409": {
                    description: "Email already registered",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "User already exists" }
                        }
                    }
                },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/auth/login": {
        post: {
            tags: ["Auth"],
            summary: "Login and obtain a JWT token",
            description:
                "Authenticates a user and returns a JWT access token. " +
                "Use the token as `Authorization: Bearer <token>` on all protected endpoints. " +
                "The token contains the user's `_id` and `role` — no separate profile fetch needed for basic auth.",
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/LoginRequest" },
                        example: {
                            email: "alice@example.com",
                            password: "Str0ngP@ss!"
                        }
                    }
                }
            },
            responses: {
                "200": {
                    description: "Login successful — token returned",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/LoginResponse" }
                        }
                    }
                },
                "400": {
                    description: "Validation failed or invalid credentials",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            examples: {
                                invalidCredentials: {
                                    summary: "Wrong password",
                                    value: { success: false, message: "Invalid credentials" }
                                },
                                validationFailed: {
                                    summary: "Missing fields",
                                    value: { success: false, message: "Invalid request body", errors: [] }
                                }
                            }
                        }
                    }
                },
                "404": {
                    description: "No account found with this email",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "User not found" }
                        }
                    }
                },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    },

    "/api/v1/auth/refresh": {
        post: {
            tags: ["Auth"],
            summary: "Refresh access token",
            description:
                "Issues a new short-lived access token (1 hour) using a valid refresh token (7 days). " +
                "Call this when the access token expires instead of asking the user to log in again. " +
                "The refresh token itself is **not** rotated — store it securely on the client.",
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: { $ref: "#/components/schemas/RefreshTokenRequest" },
                        example: { refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
                    }
                }
            },
            responses: {
                "200": {
                    description: "New access token issued",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/RefreshTokenResponse" }
                        }
                    }
                },
                "400": {
                    description: "refreshToken field missing from request body",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "refreshToken is required" }
                        }
                    }
                },
                "401": {
                    description: "Refresh token is invalid or has expired",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorResponse" },
                            example: { success: false, message: "Invalid or expired refresh token" }
                        }
                    }
                },
                "500": { $ref: "#/components/responses/InternalError" }
            }
        }
    }
};
