// TypeScript types generated from the universal job JSON schema

export type Location = {
    city?: string | null;
    country?: string | null;
};

export type Company = {
    name?: string | null;
    location?: Location;
};

export type EducationRequirement = {
    level: string;
    fields: string[];
};

export type ExperienceRequirement = {
    min_years?: number | null;
    max_years?: number | null;
};

export type Skill = {
    name: string;
    category?: string | null;
    required?: boolean;
    weight?: number | null;
    level?: "basic" | "intermediate" | "advanced" | null;
};

export type Tool = {
    name: string;
    required?: boolean;
};

export type Domain = {
    primary?: string | null;
    secondary?: string[];
};

export type SoftSkill = {
    name: string;
    weight?: number | null;
};

export type ScoringRules = {
    required_skills_must_match?: boolean;
    min_experience_required?: boolean;
};

export type ScoringConfig = {
    weights?: {
        skills?: number | null;
        experience?: number | null;
        education?: number | null;
        tools?: number | null;
        soft_skills?: number | null;
    };
    rules?: ScoringRules;
};

export type JobMetadata = {
    created_at?: string | null;
    updated_at?: string | null;
    status?: string | null;
    source?: string | null;
};

export type JobJSON = {
    _id: string;
    title?: string | null;
    company?: Company;
    employment_type?: string | null;
    seniority_level?: string | null;
    description: {
        raw: string;
        summary?: string | null;
    };
    requirements?: {
        experience?: ExperienceRequirement;
        education?: EducationRequirement[];
    };
    skills?: Skill[];
    tools?: Tool[];
    domain?: Domain;
    responsibilities?: string[];
    soft_skills?: SoftSkill[];
    scoring_config?: ScoringConfig;
    metadata?: JobMetadata;
};