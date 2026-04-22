
import type { Request, Response } from "express";
import { SourcingService } from "./sourcing.service.js";
import logger from "@/shared/utils/logger.js";
import { validateBulkUploadRequest } from "@/shared/utils/validator.js";

export class SourcingController {
    private sourcingService = new SourcingService();

    async bulkImport(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const recruiterId = user?._id;

            const { jobId, columnMappingJson, skipInvalidRows } = req.body;
            const file = req.file;

            logger.info(`[SourcingController] Bulk import request received. jobId: ${jobId}, filename: ${file?.originalname || "none"}`);

            if (!jobId || !file || !columnMappingJson) {
                logger.warn(`[SourcingController] Rejecting bulk import: Missing parameters. jobId: ${jobId}, hasFile: ${!!file}, hasMapping: ${!!columnMappingJson}`);
                return res.status(400).json({ success: false, message: "Missing required parameters (jobId, file, columnMappingJson)" });
            }

            let columnMapping;
            try {
                columnMapping = JSON.parse(columnMappingJson);
            } catch (e: any) {
                return res.status(400).json({ success: false, message: "Invalid columnMapping JSON" });
            }

            // Start background processing
            this.sourcingService.processBulkImport({
                jobId,
                file: {
                    buffer: file.buffer,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                },
                columnMapping,
                skipInvalidRows: skipInvalidRows === "true" || skipInvalidRows === true,
            }, recruiterId).catch(err => {
                logger.error(`[SourcingController] Bulk import failed: ${err.message}`);
            });

            res.status(202).json({ 
                success: true, 
                message: "Bulk import started in the background." 
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async batchUploadCVs(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const recruiterId = user?._id;
            const { jobId } = req.body;
            const files = req.files as Express.Multer.File[];

            logger.info(`[SourcingController] Batch CV upload request received. jobId: ${jobId}, filesCount: ${files?.length || 0}`);

            if (!jobId || !files || files.length === 0) {
                logger.warn(`[SourcingController] Rejecting batch upload: Missing jobId or CV files. Files received: ${files?.length || 0}`);
                return res.status(400).json({ success: false, message: "Missing jobId or CV files. Ensure you are sending files in the 'cvs' field." });
            }

            // Background process
            this.sourcingService.processBatchCVs(jobId, files, recruiterId).catch((err: Error) => {
                logger.error(`[SourcingController] Batch CV upload failed: ${err.message}`);
            });

            res.status(202).json({
                success: true,
                message: `Processing ${files.length} CVs in the background. They will appear in your dashboard shortly.`
            });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getTemplate(req: Request, res: Response) {
        const template = `First Name,Last Name,Email,Resume URL,LinkedIn\nJohn,Doe,john@example.com,https://link-to-resume.pdf,https://linkedin.com/in/johndoe`;
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="sourcing_template.csv"');
        res.send(template);
    }
}
