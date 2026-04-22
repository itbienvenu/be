
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

            if (user?.role !== "recruiter") {
                return res.status(403).json({ success: false, message: "Forbidden: Access restricted to recruiter only" });
            }

            logger.info(`[SourcingController] req.body keys: ${Object.keys(req.body || {})}`);
            logger.info(`[SourcingController] req.file present: ${!!req.file}`);

            const { jobId, columnMappingJson, skipInvalidRows } = req.body;
            const file = req.file;

            logger.info(`[SourcingController] Received import request for job ${jobId} from recruiter ${recruiterId}`);

            if (!jobId || !file || !columnMappingJson) {
                return res.status(400).json({ success: false, message: "Missing required parameters (jobId, file, columnMappingJson)" });
            }

            let columnMapping;
            try {
                columnMapping = JSON.parse(columnMappingJson);
            } catch (e: any) {
                return res.status(400).json({ success: false, message: "Invalid columnMapping JSON" });
            }

            // Validate against schema
            const validation = validateBulkUploadRequest({ 
                jobId, 
                columnMapping, 
                skipInvalidRows: skipInvalidRows === "true" || skipInvalidRows === true 
            });
            
            if (!validation.isValid) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Validation failed", 
                    errors: validation.errors 
                });
            }

            const response = await this.sourcingService.processBulkImport({
                jobId,
                file: {
                    buffer: file.buffer,
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                },
                columnMapping,
                skipInvalidRows: skipInvalidRows === "true" || skipInvalidRows === true,
            }, recruiterId);

            if (!response.success && response.message === "Job not found or unauthorized") {
                return res.status(403).json(response);
            }

            const status = response.success ? 201 : response.data.imported > 0 ? 200 : 400;
            res.status(status).json(response);
        } catch (error: any) {
            logger.error(`[SourcingController] FATAL_ERROR: ${error.message}`);
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async getTemplate(req: Request, res: Response) {
        const template = `First Name,Last Name,Email,Resume URL,LinkedIn\nJohn,Doe,john@example.com,https://link-to-resume.pdf,https://linkedin.com/in/johndoe`;
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="sourcing_template.csv"');
        res.send(template);
    }
}
