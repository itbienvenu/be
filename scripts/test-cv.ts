import { CVParserService } from "../src/modules/ai/ai.service.js";
import { PDFTool } from "../src/shared/utils/pdfs-tool.js";
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function testCV() {
    console.log("--- CV Parsing Test ---");

    try {
        const cvService = new CVParserService();
        const pdfTool = new PDFTool();

        // 1. Load the PDF file
        const pdfPath = path.join(process.cwd(), "src", "cv.pdf");
        console.log(`Reading PDF from: ${pdfPath}`);
        const pdfBuffer = await readFile(pdfPath);

        // 2. Extract text from PDF
        console.log("Extracting text from PDF...");
        const rawText = await pdfTool.readPdfFromBuffer(pdfBuffer);

        console.log("\n--- Extracted Text Preview ---");
        console.log(rawText.substring(0, 300) + "...");
        console.log("------------------------------\n");

        // 3. Send to Gemini for structured parsing
        console.log("Sending text to Gemini for structured parsing...");
        const structuredData = await cvService.parseCV(rawText);

        if (structuredData) {
            console.log("Successfully parsed CV!");
            console.log("\n--- Structured JSON Result ---");
            console.log(JSON.stringify(structuredData, null, 2));
        } else {
            console.error("Failed to parse CV structured data.");
        }

    } catch (error: any) {
        console.error("Test failed with error:");
        console.error(error.message);
    }
}

testCV();
