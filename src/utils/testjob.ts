import "dotenv/config";
import JobAIService from "./ai.js";

// Example raw job description (can be from any domain)
const rawJobDescription = `
We are looking for a Senior Agro Consultant to help farmers implement sustainable practices. 
The candidate should have at least 5 years of experience in agriculture management and crop optimization.
Skills required: soil analysis, crop rotation, farm management software, team leadership.
Education: Bachelor's degree in Agriculture or related field.
Location: Kigali, Rwanda
Employment: Full-time
`;

async function test() {
    const aiService = new JobAIService();
    const structuredJob = await aiService.generateStructuredJob(rawJobDescription);

    if (structuredJob) {
        console.log("✅ Structured Job JSON:");
        console.log(JSON.stringify(structuredJob, null, 2));
    } else {
        console.error("❌ Failed to generate structured job JSON");
    }
}

test();