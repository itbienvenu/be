import { ApplicationRepository } from "./application.repository.js";
import { ApplicantRepository } from "@/modules/applicant/applicant.repository.js";
import { JobRepository } from "@/modules/job/job.repository.js";
import type { ApplicationJSON } from "./application.types.js";

export class ApplicationService {
    private appRepo = new ApplicationRepository();
    private applicantRepo = new ApplicantRepository();
    private jobRepo = new JobRepository();

    async apply(applicantUserId: string, jobId: string, coverLetter?: string): Promise<ApplicationJSON> {
        // 1. Verify job exists and is published
        const jobResult = await this.jobRepo.getJobById(jobId, false);
        if (!jobResult.data) {
            throw new Error("Job not found");
        }
        if (jobResult.data.metadata?.status !== "published") {
            throw new Error("This job is not accepting applications");
        }

        // 2. Get applicant profile to snapshot cvUrl + cvRawText
        const applicant = await this.applicantRepo.findByUserId(applicantUserId);
        if (!applicant) {
            throw new Error("You need to complete your profile before applying. Please upload your CV and save your profile.");
        }
        
        if (!applicant.cvUrl) {
            throw new Error("No CV found on your profile. Please upload your CV in the profile section before applying.");
        }
        if (!applicant.cvRawText) {
            throw new Error("CV text content is missing from your profile. Please re-upload your CV to enable AI screening.");
        }

        // 3. Prevent duplicate applications for the same job
        const existing = await this.appRepo.findByApplicantAndJob(applicantUserId, jobId);
        if (existing) {
            throw new Error("You have already applied to this job");
        }

        // 4. Create application with snapshotted cvUrl + cvRawText
        const applicationData: any = {
            applicantId: applicantUserId,
            jobId,
            cvUrl: applicant.cvUrl,
            cvRawText: applicant.cvRawText,   // snapshot for AI screening
            status: "pending" as const,
            appliedAt: new Date(),
        };

        if (coverLetter) {
            applicationData.coverLetter = coverLetter;
        }

        return this.appRepo.create(applicationData);
    }

    async getMyApplications(applicantUserId: string) {
        return this.appRepo.findByApplicantId(applicantUserId);
    }

    async getJobApplications(jobId: string, recruiterUserId: string) {
        // Verify recruiter owns the job
        const jobResult = await this.jobRepo.getJobById(jobId, false, recruiterUserId);
        if (!jobResult.data) {
            throw new Error("Forbidden: Job not found or you do not own this job");
        }
        return this.appRepo.findByJobId(jobId);
    }

    async updateStatus(applicationId: string, status: ApplicationJSON["status"]) {
        const updated = await this.appRepo.updateStatus(applicationId, status);
        if (!updated) throw new Error("Application not found or status unchanged");
        return { success: true };
    }

    async getById(applicationId: string, requesterId: string, requesterRole: "applicant" | "recruiter") {
        const application = await this.appRepo.findById(applicationId);
        if (!application) throw new Error("Application not found");

        // Applicants can only view their own application
        if (requesterRole === "applicant" && application.applicantId?.toString() !== requesterId) {
            throw new Error("Forbidden: You do not have access to this application");
        }
        // Recruiters can only view applications for jobs they own
        if (requesterRole === "recruiter") {
            const jobResult = await this.jobRepo.getJobById(application.jobId?.toString(), false, requesterId);
            if (!jobResult.data) throw new Error("Forbidden: You do not own the job for this application");
        }
        return application;
    }
}
