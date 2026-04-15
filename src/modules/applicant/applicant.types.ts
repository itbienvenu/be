export interface ApplicantProfileJSON {
    first_name: string;
    last_name: string;
    email: string;
    headline: string;
    bio: string;
    location: string;
    gender?: "Male" | "Female" | "Other";
    nationality?: string;
    date_of_birth?: string;
    profile_picture?: string | null;
    skills: {
        name: string;
        level: "Beginner" | "Intermediate" | "Advanced" | "Expert";
        years_of_experience: number;
    }[];
    languages: {
        name: string;
        proficiency: "Beginner" | "Intermediate" | "Advanced" | "Native";
    }[];
    experience: {
        company: string;
        role: string;
        start_date: string;
        work_type: "Full-time" | "Part-time" | "Freelance";
        end_date?: string;
        location?: string;
        description?: string;
        technologies?: string[];
        is_current?: boolean;
    }[];
    education: {
        institution: string;
        degree: string;
        major?: string;
        location?: string;
        field_of_study?: string;
        start_date: string;
        end_date?: string;
    }[];
    certifications?: {
        name: string;
        issuer: string;
        issue_date?: string;
    }[];
    projects: {
        name: string;
        description?: string;
        technologies?: string[];
        link?: string | null;
        start_date?: string;
        end_date?: string;
    }[];
    availability: {
        status?: "Available" | "Not Available" | "Open to Opportunities";
        type?: "Full-time" | "Part-time" | "Freelance";
        start_date?: string;
    };
    social_links?: {
        linkedin?: string | null;
        github?: string | null;
        twitter?: string | null;
    };
    preferences?: {
        job_type?: "Remote" | "On-site" | "Hybrid";
        work_mode?: ("remote" | "on-site" | "hybrid")[];
        expected_salary?: {
            min: number;
            max: number;
            currency: string;
        };
    };
    area_of_expertise?: {
        name: string;
        experience_years: number;
    }[];
}

export interface ApplicantJSON {
    _id?: string;
    userId: string;
    cvUrl: string;
    cvPublicId: string;
    cvRawText: string;   // extracted PDF text, used for AI screening
    profile: ApplicantProfileJSON;
    createdAt?: Date;
    updatedAt?: Date;
}
