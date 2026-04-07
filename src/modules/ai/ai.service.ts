import "dotenv/config";
import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";
import type { JobJSON } from "@/modules/job/job.types.js"; // import your TS types here
import jobJsonSchema from "@/modules/job/job.schema.json" with { type: "json" }; // JSON Schema file
const jobPrompt = readFileSync(new URL("./prompts/job.prompt.txt", import.meta.url), "utf-8");



class JobAIService {
    private ajv: Ajv;
    private readonly jobJsonValidator: ValidateFunction<JobJSON>;
    private readonly apiKey: string;

    constructor(apiKey?: string) {
        const key = apiKey || process.env.GEMINI_API_KEY;
        if (!key) throw new Error("GEMINI_API_KEY is not set in environment variables");
        this.apiKey = key;

        this.ajv = new Ajv({ allErrors: true, strict: false });
        (addFormats as unknown as FormatsPlugin)(this.ajv);
        this.jobJsonValidator = this.ajv.compile(jobJsonSchema);
    }

    private extractJSON(text: string): string {
        // Try to find the content inside a JSON code block (permissive to optional 'json' tag)
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
${JSON.stringify(jobJsonSchema)}

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
                }),
                signal: AbortSignal.timeout(20000), // 20-second timeout
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
            const parsed: JobJSON = JSON.parse(cleanedText);

            // Validate against schema using cached validator
            const valid = this.jobJsonValidator(parsed);
            if (!valid) {
                console.error("Validation Errors:", this.jobJsonValidator.errors);
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