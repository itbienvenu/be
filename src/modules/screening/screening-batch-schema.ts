/**
 * JSON Schema for BatchAIResponse — used by BaseAIService to validate
 * the Gemini response and generate the responseSchema for structured output.
 */
export const batchAIResponseSchema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "BatchAIResponse",
    type: "object",
    required: ["candidates"],
    properties: {
        candidates: {
            type: "array",
            items: {
                type: "object",
                required: ["applicant_id", "skill_signals", "soft_skill_signals", "strengths", "gaps", "recommendation"],
                properties: {
                    applicant_id: { type: "string" },
                    skill_signals: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["skill_name", "score"],
                            properties: {
                                skill_name: { type: "string" },
                                score: { type: "number", minimum: 0, maximum: 1 }
                            }
                        }
                    },
                    soft_skill_signals: {
                        type: "array",
                        items: {
                            type: "object",
                            required: ["skill_name", "score"],
                            properties: {
                                skill_name: { type: "string" },
                                score: { type: "number", minimum: 0, maximum: 1 }
                            }
                        }
                    },
                    strengths: { type: "array", items: { type: "string" } },
                    gaps:      { type: "array", items: { type: "string" } },
                    recommendation: { type: "string" }
                }
            }
        }
    }
} as const;
