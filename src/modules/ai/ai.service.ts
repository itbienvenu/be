import "dotenv/config";
import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";
import type { JobJSON } from "@/modules/job/job.types.js";

// Load schemas and prompts
const jobJsonSchema = JSON.parse(readFileSync(new URL("../job/job.schema.json", import.meta.url), "utf-8"));
const applicantJsonSchema = JSON.parse(readFileSync(new URL("../applicant/applicant.schema.json", import.meta.url), "utf-8"));
const jobPrompt = readFileSync(new URL("./prompts/job.prompt.txt", import.meta.url), "utf-8");
const cvParserPrompt = readFileSync(new URL("./prompts/cv-parser.prompt.txt", import.meta.url), "utf-8");

export abstract class BaseAIService<T> {
    private ajv: Ajv;
    private readonly validator: ValidateFunction<T>;
    private readonly apiKey: string;
    private readonly responseSchema: any;
    protected abstract readonly modelName: string;
    protected abstract readonly systemPrompt: string;

    constructor(schema: any, apiKey?: string) {
        const key = apiKey || process.env.GEMINI_API_KEY;
        if (!key) throw new Error("GEMINI_API_KEY is not set in environment variables");
        this.apiKey = key;

        this.ajv = new Ajv({ 
            allErrors: true, 
            strict: false,
            coerceTypes: true // Automatically convert "1" to 1
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
                    geminiNode.type = nonNullType.toUpperCase();
                    geminiNode.nullable = true;
                }
            } else {
                geminiNode.type = schema.type.toUpperCase();
            }
        }

        if (schema.enum) {
            geminiNode.type = "STRING";  // Force STRING type for enum compatibility
            geminiNode.enum = schema.enum.map((val: any) => {
                // Convert all enum values to strings for Gemini API
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

    /**
     * Recursively convert string enum values back to numbers where the schema
     * defines numeric enums. Gemini stringifies all enum values, so we need to
     * reverse that for fields that should be numbers.
     */
    private restoreNumericEnums(data: any, schema: any): any {
        if (!data || !schema) return data;

        // Handle arrays
        if (Array.isArray(data)) {
            return data.map(item => this.restoreNumericEnums(item, schema.items));
        }

        // Handle objects
        if (typeof data === 'object' && data !== null) {
            const result = { ...data };
            
            // Check schema properties
            if (schema.properties) {
                for (const [key, propSchema] of Object.entries(schema.properties)) {
                    if (result[key] === undefined || result[key] === null) continue;

                    const ps = propSchema as any;
                    
                    // If this property has numeric enum values in the schema, convert strings to numbers
                    if (ps.enum && Array.isArray(ps.enum) && ps.enum.some((v: any) => typeof v === 'number')) {
                        if (typeof result[key] === 'string' && !isNaN(Number(result[key]))) {
                            result[key] = Number(result[key]);
                        }
                    }

                    // Recurse into nested objects/arrays
                    if (ps.properties || ps.items) {
                        result[key] = this.restoreNumericEnums(result[key], ps);
                    }
                }
            }

            return result;
        }

        return data;
    }

    protected async callAI(input: string): Promise<T | null> {
        const prompt = `${this.systemPrompt}\nInput:\n"""\n${input}\n"""`;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": this.apiKey
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0,
                        topP: 0.1,
                        topK: 40,
                        maxOutputTokens: 8192,
                        responseMimeType: "application/json",
                        responseSchema: this.responseSchema
                    },
                }),
                signal: AbortSignal.timeout(20000),
            });

            const data: any = await response.json();
            if (!response.ok) {
                console.error(`AI API Error (${this.modelName}):`, JSON.stringify(data, null, 2));
                return null;
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return null;

            const cleanedText = this.extractJSON(text);
            console.debug(`[AI RAW RESPONSE]:`, cleanedText);
            let parsed: T;
            try {
                parsed = JSON.parse(cleanedText);
            } catch (jsonErr: any) {
                console.error("AI JSON Parse Error:", jsonErr.message);
                return null;
            }

            // Convert string enum values back to numbers (Gemini stringifies numeric enums)
            parsed = this.restoreNumericEnums(parsed, this.responseSchema);

            const valid = this.validator(parsed);
            if (!valid) {
                console.error("AI Validation Errors:", JSON.stringify(this.validator.errors, null, 2));
                return null;
            }

            return parsed;
        } catch (err: any) {
            console.error(`AI Service Error (${this.modelName}):`, err.name === "AbortError" ? "Timeout" : err.message);
            return null;
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