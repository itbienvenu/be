import { JobRepository } from "./job.repository.js";
import { type JobJSON } from "./job.types.js";

export class JobService {
    private jobRepository: JobRepository;

    constructor() {
        this.jobRepository = new JobRepository();
    }
    async createJob(data: JobJSON) {
        return await this.jobRepository.createJob(data);
    }

    async getAllJobs(isPublic: boolean = true) {
        return await this.jobRepository.getAllJobs(isPublic);
    }

    async getJobById(id: string, isPublic: boolean = true, recruiterId?: string) {
        return await this.jobRepository.getJobById(id, isPublic, recruiterId);
    }

    async getJobsByRecruiter(recruiterId: string) {
        return await this.jobRepository.getJobsByRecruiter(recruiterId);
    }

    async patchJob(id: string, recruiterId: string, fields: Record<string, any>) {
        await this.jobRepository.patchJob(id, recruiterId, fields);
        return { success: true, message: "Job updated successfully" };
    }

    async publishJob(id: string, recruiterId: string) {
        await this.jobRepository.publishJob(id, recruiterId);
        return { success: true, message: "Job published successfully" };
    }

    async unpublishJob(id: string, recruiterId: string) {
        await this.jobRepository.unpublishJob(id, recruiterId);
        return { success: true, message: "Job unpublished and moved back to draft" };
    }

    async archiveJob(id: string, recruiterId: string) {
        await this.jobRepository.archiveJob(id, recruiterId);
        return { success: true, message: "Job archived successfully" };
    }

    async unarchiveJob(id: string, recruiterId: string) {
        await this.jobRepository.unarchiveJob(id, recruiterId);
        return { success: true, message: "Job unarchived and moved back to draft" };
    }
}