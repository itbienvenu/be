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
}