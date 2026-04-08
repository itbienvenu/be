import "dotenv/config";
import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";
import type { JobJSON } from "@/modules/job/job.types.js"; // import your TS types here
const jobJsonSchema = JSON.parse(readFileSync(new URL("../job/job.schema.json", import.meta.url), "utf-8"));
const jobPrompt = readFileSync(new URL("./prompts/job.prompt.txt", import.meta.url), "utf-8");



class JobAIService {
    private ajv: Ajv;
    private readonly jobJsonValidator: ValidateFunction<JobJSON>;
    private readonly apiKey: string;
    private readonly responseSchema: any;

    constructor(apiKey?: string) {
        const key = apiKey || process.env.GEMINI_API_KEY;
        if (!key) throw new Error("GEMINI_API_KEY is not set in environment variables");
        this.apiKey = key;

        this.ajv = new Ajv({ allErrors: true, strict: false });
        (addFormats as unknown as FormatsPlugin)(this.ajv);
        this.jobJsonValidator = this.ajv.compile<JobJSON>(jobJsonSchema);
        this.responseSchema = this.convertToGeminiSchema(jobJsonSchema);
    }

    private convertToGeminiSchema(schema: any): any {
        if (!schema || typeof schema !== "object") return schema;

        const geminiNode: any = {};

        if (schema.type) {
            if (Array.isArray(schema.type)) {
                // Gemini handles nullability via a 'nullable' field
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
        if (schema.items) {
            geminiNode.items = this.convertToGeminiSchema(schema.items);
        }
        if (schema.format) geminiNode.format = schema.format;

        return geminiNode;
    }

    private extractJSON(text: string): string {
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (match && match[1]) return match[1].trim();

        // Fallback: search for the first { and last }
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");

        if (start !== -1 && end !== -1 && end > start) {
            return text.substring(start, end + 1).trim();
        }

        return text.trim();
    }

    private generatePrompt(rawJobDescription: string): string {
        return `
${jobPrompt}
Raw job description:
"""
${rawJobDescription}
"""
`;
    }

    public async generateStructuredJob(rawJobDescription: string): Promise<JobJSON | null> {
        const prompt = this.generatePrompt(rawJobDescription);

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
                console.error("API Error Response:", JSON.stringify(data, null, 2));
                return null;
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return null;

            // Robust JSON extraction
            const cleanedText = this.extractJSON(text);

            // Parse JSON safely
            let parsed: JobJSON;
            try {
                parsed = JSON.parse(cleanedText);
            } catch (jsonErr: any) {
                console.error("JSON Parse Error:", jsonErr.message);
                console.error("Received text length:", cleanedText.length);
                console.error("Text snippet (last 100 chars):", cleanedText.slice(-100));
                return null;
            }

            // Validate against schema using cached validator
            const valid = this.jobJsonValidator(parsed);
            if (!valid) {
                console.error("Validation Errors:", JSON.stringify(this.jobJsonValidator.errors, null, 2));
                return null;
            }

            return parsed;
        } catch (err: any) {
            if (err.name === "AbortError") {
                console.error("Error: AI service request timed out after 20 seconds.");
            } else {
                console.error("Error:", err.message);
            }
            return null;
        }
    }
}

export default JobAIService;