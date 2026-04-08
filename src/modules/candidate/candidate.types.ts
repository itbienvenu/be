import { ObjectId } from "mongodb";

export interface Candidate {
    _id?: string | ObjectId;
    fullName: string;
    email: string;
    phoneNumber?: string | undefined;
    cvUrl: string;
    cvPublicId: string;
    cvText: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface CreateCandidateDTO {
    fullName: string;
    email: string;
    phoneNumber?: string | undefined;
}

export interface LoginCandidateDTO {
    email: string;
    password: string;
}