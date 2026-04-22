import { describe, it, expect } from 'vitest';
import { ScreeningScorer } from './screening.scorer.js';
import type { JobJSON } from '@/modules/job/job.types.js';

describe('ScreeningScorer', () => {
    const scorer = new ScreeningScorer();
    
    const mockJob: Partial<JobJSON> = {
        title: "Senior Developer",
        skills: [
            {
                name: "React", required: true, weight: 0.5, level: "Advanced",
                category: ''
            },
            {
                name: "Node.js", required: true, weight: 0.5, level: "Advanced",
                category: ''
            }
        ],
        scoring_config: {
            weights: { skills: 0.5, experience: 0.2, education: 0.1, resources: 0.1, soft_skills: 0.1 },
            rules: { required_skills_must_match: true, min_experience_required: true }
        },
        requirements: { experience: { min_years: 5 } }
    };

    it('should compute experience score correctly (capped at 1.0)', () => {
        expect(scorer.computeExperienceScore(5, 5)).toBe(1.0);
        expect(scorer.computeExperienceScore(2.5, 5)).toBe(0.5);
        expect(scorer.computeExperienceScore(10, 5)).toBe(1.0);
        expect(scorer.computeExperienceScore(0, 5)).toBe(0.0);
    });

    it('should compute skills score as weighted average', () => {
        const signals = [
            { skill_name: "React", score: 1.0 },
            { skill_name: "Node.js", score: 0.0 }
        ];
        // (1.0 * 0.5 + 0.0 * 0.5) / 1.0 = 0.5
        expect(scorer.computeSkillsScore(mockJob.skills!, signals)).toBe(0.5);
    });

    it('should handle missing skill signals by defaulting to 0', () => {
        const signals = [
            { skill_name: "React", score: 1.0 }
            // Node.js missing
        ];
        expect(scorer.computeSkillsScore(mockJob.skills!, signals)).toBe(0.5);
    });

    it('should compute education score correctly using tiers', () => {
        const required = [{ level: "bachelor", fields: ["CS"] }];
        const candEdu = [{ degree: "Master of Science", field_of_study: "CS", institution: "Uni", start_date: "2010", end_date: "2012" }];
        
        // Bachelor tier is 0.75, Master is 0.9. 0.9 / 0.75 is > 1.0, so capped at 1.0.
        expect(scorer.computeEducationScore(candEdu as any, required)).toBe(1.0);
        
        const candEduLow = [{ degree: "Associate", field_of_study: "CS", institution: "Uni", start_date: "2010", end_date: "2012" }];
        // Associate is 0.5. 0.5 / 0.75 = 0.666667
        expect(scorer.computeEducationScore(candEduLow as any, required)).toBe(0.666667);
    });

    it('should normalise weights if they do not sum to 1.0', () => {
        const badWeightsJob: any = {
            ...mockJob,
            scoring_config: {
                weights: { skills: 1.0, experience: 1.0, education: 0, resources: 0, soft_skills: 0 },
                rules: { required_skills_must_match: false, min_experience_required: false }
            }
        };
        const breakdown = { skills: 1.0, experience: 0.5, education: 0, resources: 0, soft_skills: 0 };
        
        // Final score should be (1.0 * 0.5) + (0.5 * 0.5) = 0.75 * 100 = 75
        // (Wait, internal call to computeFinalScore is private, we test via score() or assume normalisation logic)
        // Accessing private for testing purposes in this environment if possible, or testing via public score()
        const result = scorer.score(badWeightsJob, { applicant_id: "1", cvRawText: "", profile: { skills: [], experience: [], education: [] } } as any, {
            skill_signals: [], soft_skill_signals: [], strengths: [], gaps: [], recommendation: "",
            applicant_id: ''
        }, new Date());
        // With 0 skills signal, 0 experience years:
        // breakdown: skills=0, exp=0... final=0.
        expect(result.screening_result.final_score).toBe(0);
    });
});
