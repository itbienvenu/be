
export interface ColumnMapping {
    /**
     * Maps system field names to Excel column names.
     */
    first_name?: string;
    last_name?: string;
    email?: string;
    resume_url?: string;        // URL to fetch resume from
    phone?: string;
    headline?: string;
    bio?: string;
    linkedin?: string;
    github?: string;
}

export interface SourcingBulkUploadRequest {
    jobId: string;
    file: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
    };
    columnMapping: ColumnMapping;
    skipInvalidRows?: boolean;
}

export interface RawCandidateRow {
    row_number: number;
    data: Record<string, any>;
}

export interface MappedCandidateData {
    row_number: number;
    first_name: string;
    last_name: string;
    email: string;
    resume_url?: string;
    phone?: string;
    headline?: string;
    bio?: string;
    linkedin?: string;
    github?: string;
}

export interface CandidateProcessResult {
    row_number: number;
    first_name: string;
    last_name: string;
    email: string;
    success: boolean;
    applicantId?: string;
    applicationId?: string;
    error?: {
        stage: "validation" | "fetch" | "parse" | "save";
        message: string;
    };
}

export interface SourcingBulkUploadResponse {
    success: boolean;
    data: {
        imported: number;
        failed: number;
        total: number;
        jobId: string;
        results: CandidateProcessResult[];
    };
    message: string;
}
