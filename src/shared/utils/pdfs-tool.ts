import * as pdfImport from "pdf-parse";
const pdf = (pdfImport as any).default || pdfImport;
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
     * @param fileBuffer Buffer of the PDF file
     * @returns UploadResponse
     */
    async uploadToCloudinary(fileBuffer: Buffer): Promise<UploadResponse> {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({
                folder: "cvs",
                resource_type: "raw",
            }, (error, result) => {
                if (error) {
                    logger.error("Cloudinary upload failed", error);
                    return reject(new ServiceError("Cloudinary upload failed", error));
                }
                if (!result) {
                    logger.error("Cloudinary upload produced no result");
                    return reject(new ServiceError("Cloudinary upload produced no result"));
                }
                logger.info("Cloudinary upload successful", result);
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
            const data = await pdf(buffer);

            const text = data.text?.trim();

            if (!text || text.length < 50) {
                throw new Error("Invalid or empty PDF content");
            }

            return text;
        } catch (error: any) {
            throw new Error(`PDF parsing failed: ${error.message}`);
        }
    }
}