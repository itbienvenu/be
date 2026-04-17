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

        this.ajv = new Ajv({ allErrors: true, strict: false });
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

        if (schema.enum) geminiNode.enum = schema.enum;
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
            let parsed: T;
            try {
                parsed = JSON.parse(cleanedText);
            } catch (jsonErr: any) {
                console.error("AI JSON Parse Error:", jsonErr.message);
                return null;
            }

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