import { RecruiterRepository } from "./recruiter.repository.js";
import { JobRepository } from "@/modules/job/job.repository.js";
import type { RecruiterJSON, RecruiterProfileJSON } from "./recruiter.types.js";

export class RecruiterService {
    private recruiterRepo: RecruiterRepository;
    private jobRepo: JobRepository;

    constructor() {
        this.recruiterRepo = new RecruiterRepository();
        this.jobRepo = new JobRepository();
    }

    async getAnalytics(userId: string) {
        return this.jobRepo.getRecruiterStats(userId);
    }

    /**
     * Update/Create recruiter profile
     */
    async updateProfile(userId: string, profile: RecruiterProfileJSON): Promise<RecruiterJSON | null> {
        const success = await this.recruiterRepo.upsertByUserId(userId, profile);
        if (success) {
            return this.recruiterRepo.findByUserId(userId);
        }
        return null;
    }

    /**
     * Get recruiter profile
     */
    async getProfile(userId: string): Promise<RecruiterJSON | null> {
        return this.recruiterRepo.findByUserId(userId);
    }
}
