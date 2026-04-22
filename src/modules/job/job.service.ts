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

    async getAllJobs(isPublic: boolean = true, page: number = 1, limit: number = 10) {
        return await this.jobRepository.getAllJobs(isPublic, page, limit);
    }

    async getJobById(id: string, isPublic: boolean = true, recruiterId?: string) {
        return await this.jobRepository.getJobById(id, isPublic, recruiterId);
    }

    async getJobsByRecruiter(recruiterId: string, page: number = 1, limit: number = 10) {
        return await this.jobRepository.getJobsByRecruiter(recruiterId, page, limit);
    }

    async patchJob(id: string, recruiterId: string, fields: Record<string, any>) {
        await this.jobRepository.patchJob(id, recruiterId, fields);
        return await this.getJobById(id, false, recruiterId);
    }

    async publishJob(id: string, recruiterId: string) {
        await this.jobRepository.publishJob(id, recruiterId);
        return await this.getJobById(id, false, recruiterId);
    }

    async unpublishJob(id: string, recruiterId: string) {
        await this.jobRepository.unpublishJob(id, recruiterId);
        return await this.getJobById(id, false, recruiterId);
    }

    async archiveJob(id: string, recruiterId: string) {
        await this.jobRepository.archiveJob(id, recruiterId);
        return await this.getJobById(id, false, recruiterId);
    }

    async unarchiveJob(id: string, recruiterId: string) {
        await this.jobRepository.unarchiveJob(id, recruiterId);
        return await this.getJobById(id, false, recruiterId);
    }

    async deleteJob(id: string, recruiterId: string) {
        return await this.jobRepository.deleteJob(id, recruiterId);
    }
}