import "dotenv/config";
import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";
import type { JobJSON } from "@/modules/job/job.types.js";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import logger from "@/shared/utils/logger.js";

// Load schemas and prompts
const jobJsonSchema = JSON.parse(readFileSync(new URL("../job/job.schema.json", import.meta.url), "utf-8"));
const applicantJsonSchema = JSON.parse(readFileSync(new URL("../applicant/applicant.schema.json", import.meta.url), "utf-8"));
const jobPrompt = readFileSync(new URL("./prompts/job.prompt.txt", import.meta.url), "utf-8");
const cvParserPrompt = readFileSync(new URL("./prompts/cv-parser.prompt.txt", import.meta.url), "utf-8");
const generateJobPrompt = readFileSync(new URL("./prompts/generate-job.prompt.txt", import.meta.url), "utf-8");
const coverLetterPrompt = readFileSync(new URL("./prompts/cover-letter.prompt.txt", import.meta.url), "utf-8");
const coverLetterSchema = JSON.parse(readFileSync(new URL("../applicant/cover-letter.schema.json", import.meta.url), "utf-8"));
const generateJobSchema = JSON.parse(readFileSync(new URL("../job/generate-job.schema.json", import.meta.url), "utf-8"));

export class AIError extends Error {
    constructor(message: string, public readonly model: string) {
        super(message);
        this.name = "AIError";
    }
}

export class AIRateLimitError extends AIError {
    constructor(message: string, model: string) {
        super(message, model);
        this.name = "AIRateLimitError";
    }
}

export abstract class BaseAIService<T> {
    private ajv: Ajv;
    private readonly validator: ValidateFunction<T>;
    private static keyCooldowns: Map<string, number> = new Map();
    private readonly apiKeys: string[];
    private currentKeyIndex: number = 0;
    private genAI: GoogleGenerativeAI;
    private readonly responseSchema: any;
    protected abstract readonly modelName: string;
    protected abstract readonly systemPrompt: string;

    constructor(schema: any, apiKey?: string) {
        const envKey = process.env.GEMINI_API_KEY || "";
        if (apiKey) {
            this.apiKeys = [apiKey];
        } else {
            this.apiKeys = envKey.split(",").map(k => k.trim()).filter(k => k.length > 0);
        }

        if (this.apiKeys.length === 0) {
            throw new Error("GEMINI_API_KEY is not set in environment variables");
        }

        this.genAI = new GoogleGenerativeAI(this.apiKeys[0] as string);

        this.ajv = new Ajv({
            allErrors: true,
            strict: false,
            // Gemini often returns numbers as strings; AJV coercion converts them back to numbers
            coerceTypes: true
        });
        (addFormats as unknown as FormatsPlugin)(this.ajv);
        this.validator = this.ajv.compile<T>(schema);
        this.responseSchema = this.convertToGeminiSchema(schema);
    }

    private convertToGeminiSchema(schema: any): any {
        if (!schema || typeof schema !== "object") return schema;
        const geminiNode: any = {};

        if (schema.type) {
            if (Array.isArray(schema.type)) {
                const nonNullType = schema.type.find((t: string) => t !== "null");
                if (nonNullType) {
                    geminiNode.type = nonNullType.toUpperCase() as SchemaType;
                    geminiNode.nullable = true;
                }
            } else {
                geminiNode.type = schema.type.toUpperCase() as SchemaType;
            }
        }

        if (schema.enum) {
            geminiNode.type = SchemaType.STRING;  // Force STRING type for enum compatibility
            geminiNode.enum = schema.enum.map((val: any) => {
                return typeof val === 'number' ? String(val) : val;
            });
        }
        if (schema.required) geminiNode.required = schema.required;
        if (schema.properties) {
            geminiNode.properties = Object.fromEntries(
                Object.entries(schema.properties).map(([k, v]) => [k, this.convertToGeminiSchema(v)])
            );
        }
        if (schema.items) geminiNode.items = this.convertToGeminiSchema(schema.items);
        if (schema.format) geminiNode.format = schema.format;

        return geminiNode;
    }

    private extractJSON(text: string): string {
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (match && match[1]) return match[1].trim();

        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");

        if (start !== -1 && end !== -1 && end > start) {
            return text.substring(start, end + 1).trim();
        }
        return text.trim();
    }

    protected async callAI(input: string, retryCount = 0): Promise<T | null> {
        const prompt = `${this.systemPrompt}\nInput:\n"""\n${input}\n"""`;
        const model = this.genAI.getGenerativeModel({
            model: this.modelName,
            generationConfig: {
                temperature: 0,
                topP: 0.1,
                topK: 40,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
                responseSchema: this.responseSchema,
            }
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("AI_REQUEST_TIMEOUT")), 60000)
        );

        try {
            const result = await Promise.race([
                model.generateContent({
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                }),
                timeoutPromise
            ]) as any;

            const response = await result.response;
            const text = response.text();
            if (!text) return null;

            const cleanedText = this.extractJSON(text);
            let parsed: T;
            try {
                parsed = JSON.parse(cleanedText);
            } catch (jsonErr: any) {
                logger.error("AI JSON Parse Error", {
                    error: jsonErr.message,
                    model: this.modelName,
                    // Truncate to avoid logging full PII if parsing fails mid-way
                    snippet: cleanedText.substring(0, 100) + "..."
                });
                return null;
            }

            const valid = this.validator(parsed);
            if (!valid) {
                logger.error(`AI Validation Errors (${this.modelName})`, {
                    errors: this.validator.errors,
                    // PII-Safe: Only log a small prefix to help debug structural issues
                    responsePrefix: cleanedText.substring(0, 100) + "..."
                });
                return null;
            }
            return parsed;
        } catch (err: any) {
            const isTimeout = err.message === "AI_REQUEST_TIMEOUT";
            const isRateLimit = err.message?.includes("429") || err.status === 429;

            // Handle Retriable Failures (Rate Limits or Timeouts)
            if (isRateLimit || isTimeout) {
                const maxRetries = 5;

                // If it's a rate limit and we have multiple keys, try rotating first
                if (isRateLimit && this.apiKeys.length > 1 && retryCount < this.apiKeys.length) {
                    const failedKey = this.apiKeys[this.currentKeyIndex] as string;
                    // Mark key as "on cooldown" for 60 seconds
                    BaseAIService.keyCooldowns.set(failedKey, Date.now() + 60000);

                    // Find next available key
                    let foundKey = false;
                    for (let i = 0; i < this.apiKeys.length; i++) {
                        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
                        const key = this.apiKeys[this.currentKeyIndex] as string;
                        const cooldownUntil = BaseAIService.keyCooldowns.get(key) || 0;

                        if (Date.now() > cooldownUntil) {
                            foundKey = true;
                            break;
                        }
                    }

                    if (foundKey) {
                        const nextKey = this.apiKeys[this.currentKeyIndex] as string;
                        this.genAI = new GoogleGenerativeAI(nextKey);
                        logger.info(`AI Rate Limit hit. Rotating to fresh API Key #${this.currentKeyIndex + 1}...`, {
                            model: this.modelName
                        });
                        // Retry immediately with the new key
                        return this.callAI(input, retryCount + 1);
                    } else {
                        logger.warn(`AI Rate Limit hit. All ${this.apiKeys.length} keys are currently exhausted/cooling down.`);
                    }
                }

                if (retryCount < 10) {
                    // Exponential backoff with jitter: (2^retry * 3000) + random(0, 1000)
                    const delayMs = Math.pow(2, retryCount) * 3000 + Math.floor(Math.random() * 1000);
                    logger.warn(`AI ${isTimeout ? "Timeout" : "Rate Limit"} hit. Retrying (Attempt ${retryCount + 1})...`, {
                        attempt: retryCount + 1,
                        delayMs,
                        model: this.modelName
                    });
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    return this.callAI(input, retryCount + 1);
                }

                if (isRateLimit) {
                    throw new AIRateLimitError(`AI rate limit exceeded after 10 retries across all keys`, this.modelName);
                }
            }

            logger.error(`AI Service Error (${this.modelName})`, { error: err.message });
            throw new AIError(err.message || "Unknown AI service error", this.modelName);
        }
    }
}

/**
 * Service for generating structured job data from raw descriptions
 */
export class JobAIService extends BaseAIService<JobJSON> {
    protected readonly modelName = process.env.GEMINI_AI_MODEL || "gemini-1.5-flash";
    protected readonly systemPrompt = jobPrompt;

    constructor(apiKey?: string) {
        super(jobJsonSchema, apiKey);
    }

    public async generateStructuredJob(description: string): Promise<JobJSON | null> {
        return this.callAI(description);
    }
}

/**
 * Service for parsing resumes (CVs) into structured applicant data
 */
export class CVParserService extends BaseAIService<any> {
    protected readonly modelName = process.env.GEMINI_AI_MODEL || "gemini-2.0-flash-lite";
    protected readonly systemPrompt = cvParserPrompt;

    constructor(apiKey?: string) {
        super(applicantJsonSchema, apiKey);
    }

    public async parseCV(rawCV: string): Promise<any | null> {
        return this.callAI(rawCV);
    }
}

/**
 * Service for generating personalized cover letters
 */
export interface CoverLetterResponse {
    subject: string;
    content: string;
    highlights: string[];
    tips: string;
}

export class CoverLetterAIService extends BaseAIService<CoverLetterResponse> {
    protected readonly modelName = process.env.GEMINI_AI_MODEL || "gemini-1.5-flash";
    protected readonly systemPrompt = coverLetterPrompt;

    constructor(apiKey?: string) {
        super(coverLetterSchema, apiKey);
    }

    public async generateCoverLetter(cv: string, job: string, instructions?: string): Promise<CoverLetterResponse | null> {
        const input = `
APPLICANT CV:
${cv}

JOB DESCRIPTION:
${job}

CUSTOM INSTRUCTIONS:
${instructions || "None provided. Write a standard professional cover letter."}
        `.trim();

        return this.callAI(input);
    }
}

/**
 * Service for generating a full job description from a simple input
 */
export interface JobGenerationResponse {
    full_description: string;
}

export class JobGeneratorAIService extends BaseAIService<JobGenerationResponse> {
    protected readonly modelName = process.env.GEMINI_AI_MODEL || "gemini-1.5-flash";
    protected readonly systemPrompt = generateJobPrompt;

    constructor(apiKey?: string) {
        super(generateJobSchema, apiKey);
    }

    public async generateFullDescription(simpleInput: string): Promise<JobGenerationResponse | null> {
        return this.callAI(simpleInput);
    }
}