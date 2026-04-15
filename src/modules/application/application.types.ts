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
}
