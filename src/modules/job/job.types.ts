// TypeScript types generated from the universal job JSON schema

export type Location = {
    city: string;
    country: string;
};

export type Company = {
    name: string;
    location: Location;
};

export type EducationRequirement = {
    level: string;
    fields: string[];
};

export type ExperienceRequirement = {
    min_years?: number;
    max_years?: number | null;
    roles?: string[];
};

export type Skill = {
    name: string;
    category: string;
    required: boolean;
    weight: number;
    level: string;
};

export type Resource = {
    name: string;
    required: boolean;
};

export type Domain = {
    primary: string;
    secondary?: string[];
};

export type SoftSkill = {
    name: string;
    weight?: number;
};

export type ScoringRules = {
    required_skills_must_match: boolean;
    min_experience_required: boolean;
};

export type ScoringConfig = {
    weights: {
        skills: number;
        experience: number;
        education: number;
        resources: number;
        soft_skills: number;
    };
    rules: ScoringRules;
};

export type JobStatus = "draft" | "published" | "archived";

export type EmploymentType = "full_time" | "part_time" | "contract" | "temporary" | "internship";

export type SeniorityLevel = "junior" | "mid" | "senior" | "lead" | "manager" | "director";

export type JobMetadata = {
    created_at: string;
    updated_at: string;
    status: JobStatus;
    source: string;
};

export type JobJSON = {
    _id?: string;
    recruiterId: string;
    title: string;
    company: Company;
    employment_type?: EmploymentType;
    seniority_level?: SeniorityLevel;
    description: {
        raw: string;
        summary?: string;
    };
    requirements?: {
        experience?: ExperienceRequirement;
        education?: EducationRequirement[];
        certifications?: string[];
    };
    skills?: Skill[];
    resources?: Resource[];
    domain: Domain;
    responsibilities?: string[];
    soft_skills?: SoftSkill[];
    physical_requirements?: {
        lifting_kg?: number;
        standing_hours?: number;
    };
    languages?: string[];
    work_conditions?: string[];
    travel_required?: boolean | null;
    scoring_config: ScoringConfig;
    metadata: JobMetadata;
};