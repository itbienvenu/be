import { PDFParse } from "pdf-parse";
import { v2 as cloudinary } from "cloudinary";
import { ServiceError } from "./custom-errors.js";
import dotenv from "dotenv";
import logger from "@/shared/utils/logger.js";
dotenv.config();


interface UploadResponse {
    url: string;
    publicId: string;
}

export class PDFTool {
    constructor() {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
            api_key: process.env.CLOUDINARY_API_KEY!,
            api_secret: process.env.CLOUDINARY_API_SECRET!,
        });
    }

    /**
     * Upload PDF to Cloudinary
     * @param fileBuffer PDF file buffer
     * @param filename Optional original filename to help Cloudinary identify the file type
     * @returns URL and Public ID of the uploaded PDF
     */
    async uploadToCloudinary(fileBuffer: Buffer, filename?: string): Promise<{ url: string; publicId: string }> {
        return new Promise((resolve, reject) => {
            const uploadOptions: any = {
                folder: "cvs",
                resource_type: "auto", // Auto-detect file type (PDFs are handled as documents/images)
            };

            if (filename) {
                uploadOptions.use_filename = true;
                uploadOptions.unique_filename = true;
                // Cloudinary uses the filename to determine the extension if resource_type is auto
                uploadOptions.filename_override = filename;
            }

            cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
                if (error) {
                    logger.error("Cloudinary upload failed", error);
                    return reject(new ServiceError("Cloudinary upload failed", error));
                }
                if (!result) {
                    logger.error("Cloudinary upload produced no result");
                    return reject(new ServiceError("Cloudinary upload produced no result"));
                }
                logger.info(`Cloudinary upload successful for ${filename || "unknown file"}`, {
                    url: result.secure_url,
                    public_id: result.public_id,
                    format: result.format
                });
                resolve({
                    url: result.secure_url,
                    publicId: result.public_id,
                });
            }).end(fileBuffer);
        });
    }

    /**
     * Delete PDF from Cloudinary
     * @param publicId Public ID of the PDF to delete
     */
    async deleteFromCloudinary(publicId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.destroy(publicId, (error, result) => {
                if (error) {
                    logger.error("Cloudinary deletion failed", error);
                    return reject(new ServiceError("Cloudinary deletion failed", error));
                }
                if (!result) {
                    logger.error("Cloudinary deletion produced no result");
                    return reject(new ServiceError("Cloudinary deletion produced no result"));
                }
                logger.info("Cloudinary deletion successful");
                resolve();
            });
        });
    }
    /**
     * Extract text from PDF buffer
     * @param buffer PDF file buffer
     * @returns text content of PDF
     */
    async readPdfFromBuffer(buffer: Buffer): Promise<string> {
        try {
            // Dynamic import to handle both v1 and v2 pdf-parse versions and CJS/ESM interop
            const pdfModule: any = await import("pdf-parse");

            let text = "";

            // Check for v2 (Mehmet Kozan fork) class API
            if (pdfModule.PDFParse) {
                const parser = new pdfModule.PDFParse({ data: buffer });
                const result = await parser.getText();
                text = result.text || "";
            }
            // Check for v1 functional API (default or direct export)
            else {
                const pdfFunc = pdfModule.default || (typeof pdfModule === "function" ? pdfModule : null);
                if (typeof pdfFunc === "function") {
                    const result = await pdfFunc(buffer);
                    text = result.text || "";
                } else {
                    throw new Error("No valid PDF parsing function or class found in pdf-parse module");
                }
            }

            const trimmedText = text.trim();
            if (!trimmedText || trimmedText.length < 20) {
                throw new Error("Extracted PDF content is too short or empty");
            }

            return trimmedText;
        } catch (error: any) {
            logger.error(`[PDFTool] readPdfFromBuffer failed: ${error.message}`);
            throw new Error(`PDF parsing failed: ${error.message}`);
        }
    }
}