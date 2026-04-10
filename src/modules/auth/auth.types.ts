export type UserJSON = {
    _id?: string;
    name: string;
    email: string;
    password: string;
    role: string;
}

export type LoginJSON = {
    email: string;
    password: string;
}

export type LogoutJSON = {
    token: string;
}

export type LoginResponseJSON = {
    success: boolean;
    message: string;
    data: {
        token: string;
        user: Omit<UserJSON, "password">;
    }
}

export type RegisterResponseJSON = {
    success: boolean;
    message: string;
    data: Omit<UserJSON, "password">;
}