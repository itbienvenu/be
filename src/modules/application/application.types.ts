import type { ScreeningResult } from "@/modules/screening/screening.types.js";

export type ApplicationStatus = "pending" | "reviewed" | "shortlisted" | "rejected" | "hired";

export interface ApplicationJSON {
    _id?: string;
    applicantId: string;   // ref to applicants collection
    jobId: string;         // ref to jobs collection
    cvUrl: string;         // snapshot from applicant profile at submission time
    cvRawText: string;     // snapshot of extracted CV text for AI screening
    coverLetter?: string;
    status: ApplicationStatus;
    appliedAt: Date;
    updatedAt?: Date;
    screening_result?: ScreeningResult; // populated after AI screening is triggered
}

/** Embedded job shape returned by findById aggregation */
export interface ApplicationDetailJob {
    _id: string;
    title: string;
    seniority_level: string;
    employment_type: string;
    company: Record<string, any>;
    domain: { primary: string };
    metadata: { status: string };
    description: { summary: string };
}

/** Full application detail — joined with job context (used by applicant and recruiter) */
export interface ApplicationDetail {
    _id: string;
    applicantId: string;
    jobId: string;
    status: ApplicationStatus;
    appliedAt: Date;
    updatedAt?: Date;
    coverLetter?: string;
    screening_result?: ScreeningResult;
    job?: ApplicationDetailJob;
}

/** Minimal screening summary embedded in the applicant follow-up view */
export interface ScreeningResultSummary {
    rank: number | null;
    final_score: number;
    recommendation: string;
    screened_at: Date;
}

/** Embedded job shape returned by findByApplicantId aggregation */
export interface ApplicationMyViewJob {
    _id: string;
    title: string;
    seniority_level: string;
    employment_type: string;
    company: { name: string; location: Record<string, any> };
    domain: { primary: string };
    metadata: { status: string };
    description: { summary: string };
}

/** Applicant follow-up view — minimal job info + screening summary */
export interface ApplicationMyView {
    _id: string;
    status: ApplicationStatus;
    appliedAt: Date;
    updatedAt?: Date;
    coverLetter?: string;
    screening_result?: ScreeningResultSummary;
    job?: ApplicationMyViewJob;
}
