export interface RecruiterLocation {
    address?: string;
    city: string;
    country: string;
}

export interface RecruiterProfileJSON {
    company_name: string;
    industry: string;
    website?: string | null;
    location: RecruiterLocation;
    bio?: string;
    company_logo?: string | null;
    social_links?: {
        linkedin?: string | null;
        twitter?: string | null;
    };
}

export interface RecruiterJSON {
    _id?: string;
    userId: string;
    profile: RecruiterProfileJSON;
    user_details?: {
        name: string;
        email: string;
        role: string;
    };
    createdAt?: Date;
    updatedAt?: Date;
}
