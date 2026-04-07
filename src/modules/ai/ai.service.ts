import "dotenv/config";
import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
// @ts-ignore
import addFormats from "ajv-formats";
import type { JobJSON } from "@/modules/job/job.types.js"; // import your TS types here
import jobJsonSchema from "@/modules/job/job.schema.json" with { type: "json" }; // JSON Schema file
const jobPrompt = readFileSync(new URL("./prompts/job.prompt.txt", import.meta.url), "utf-8");

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables");

class JobAIService {
    private ajv: Ajv;

    constructor() {
        this.ajv = new Ajv({ allErrors: true, strict: false });
        // @ts-expect-error
        addFormats(this.ajv);
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

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            });

            const data: any = await response.json();

            if (!response.ok) {
                console.error("API Error Response:", JSON.stringify(data, null, 2));
                return null;
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return null;

            // Clean JSON string (remove markdown blocks if present)
            const cleanedText = text
                .replace(/^```json\n?/, "")
                .replace(/\n?```$/, "")
                .trim();

            // Parse JSON safely
            const parsed: JobJSON = JSON.parse(cleanedText);

            // Validate against schema
            const validate = this.ajv.compile(jobJsonSchema);
            const valid = validate(parsed);
            if (!valid) {
                console.error("Validation Errors:", validate.errors);
                return null;
            }

            return parsed;
        } catch (err: any) {
            console.error("Error:", err.message);
            return null;
        }
    }
}

export default JobAIService;