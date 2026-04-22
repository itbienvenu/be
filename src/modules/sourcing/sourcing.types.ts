
/**
 * Talent Profile Schema specifically for the Umurava AI Hackathon.
 * Used internally in the Sourcing module to ensure strict compatibility with the ranking system.
 */
export interface TalentProfile {
    "First Name": string;
    "Last Name": string;
    "Email": string;
    "Headline": string;
    "Bio"?: string;
    "Location": string;
    "skills": {
        "name": string;
        "level": "Beginner" | "Intermediate" | "Advanced" | "Expert";
        "yearsOfExperience": number;
    }[];
    "languages"?: {
        "name": string;
        "proficiency": "Basic" | "Conversational" | "Fluent" | "Native";
    }[];
    "experience": {
        "company": string;
        "role": string;
        "Start Date": string;
        "End Date"?: string;
        "description"?: string;
        "technologies"?: string[];
        "Is Current"?: boolean;
    }[];
    "education": {
        "institution": string;
        "degree": string;
        "Field of Study": string;
        "Start Year": number;
        "End Year": number;
    }[];
    "certifications"?: {
        "name": string;
        "issuer": string;
        "Issue Date"?: string;
    }[];
    "projects": {
        "name": string;
        "description"?: string;
        "technologies"?: string[];
        "role"?: string;
        "link"?: string | null;
        "Start Date"?: string;
        "End Date"?: string;
    }[];
    "availability": {
        "status": "Available" | "Open to Opportunities" | "Not Available";
        "type": "Full-time" | "Part-time" | "Contract" | "Freelance";
        "Start Date"?: string;
    };
    "socialLinks"?: {
        "linkedin"?: string | null;
        "github"?: string | null;
        "portfolio"?: string | null;
    };
}

export interface ColumnMapping {
    first_name?: string;
    last_name?: string;
    email?: string;
    resume_url?: string;
    headline?: string;
    bio?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
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
    headline?: string;
    bio?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
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
