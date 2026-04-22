
import { BaseAIService } from "@/modules/ai/ai.service.js";
import talentProfileSchema from "./talent-profile.schema.json" with { type: "json" };
import { readFileSync } from "node:fs";

/**
 * Prompt specific to the Hackathon Talent Profile Schema.
 */
const sourcingPrompt = `
You are a specialized talent acquisition AI. Your task is to extract candidate data from a CV and output it strictly in JSON format matching the Umurava Talent Profile Schema.

### Instructions:
1. Extract components into the following fields exactly:
   - "First Name" & "Last Name": Split the full name.
   - "Email": Extract valid email.
   - "Headline": Professional title.
   - "Bio": Brief professional summary.
   - "Location": City and Country.
   - "skills": Array with "name", "level" (Beginner|Intermediate|Advanced|Expert), and "yearsOfExperience" (integer).
   - "languages": Array with "name", "proficiency" (Basic|Conversational|Fluent|Native).
   - "experience": Array with "company", "role", "Start Date", "End Date", "description", "technologies", "Is Current".
   - "education": Array with "institution", "degree", "Field of Study", "Start Year", "End Year".
   - "certifications": Array with "name", "issuer", "Issue Date".
   - "projects": Array with "name", "description", "technologies", "Start Date", "End Date".
   - "availability": Map to "Available" | "Open to Opportunities" | "Not Available".
   - "socialLinks": Map "linkedin", "github", "portfolio".

2. Dates: Use "YYYY-MM" format. Years: Use integer YYYY.
3. Required Fields: If missing, use empty strings or arrays. Do not omit mandatory fields.

Output Constraints: Return ONLY valid JSON.
`;

export class SourcingAIService extends BaseAIService<any> {
    protected readonly modelName = process.env.GEMINI_AI_MODEL || "gemini-2.0-flash-lite";
    protected readonly systemPrompt = sourcingPrompt;

    constructor(apiKey?: string) {
        super(talentProfileSchema, apiKey);
    }

    public async parseCV(rawCV: string): Promise<any | null> {
        return this.callAI(rawCV);
    }
}
