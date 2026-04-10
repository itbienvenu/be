import "dotenv/config";
import { JobAIService } from "./modules/ai/ai.service.js";
import { readFileSync } from "node:fs";

async function test() {
    console.log("Starting validation test...");
    const aiService = new JobAIService();

    const jobDescription = `
    Job Title: senior software engineer
    Company: TechCorp
    Location: Kigali, Rwanda
    Type: Full-time
    Seniority: Senior
    
    Requirements:
    - 5 years of experience in Node.js and TypeScript
    - Bachelor's degree in Computer Science
    
    Skills:
    - Node.js (Core, 0.9 weight, advanced)
    - TypeScript (Core, 0.9 weight, advanced)
    - MongoDB (Supporting, 0.5 weight, intermediate)
    
    Responsibilities:
    - Develop scalable backend services
    - Mentor junior developers
    
    Domains: Technology, Software Engineering
    `;

    console.log("Calling AI service...");
    const result = await aiService.generateStructuredJob(jobDescription);

    if (result) {
        console.log("SUCCESS: Structured job generated and validated!");
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log("FAILURE: Failed to generate or validate structured job.");
    }
}

test().catch(console.error);
