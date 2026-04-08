import bcrypt from "bcrypt";
import { Ajv, type Schema } from "ajv";
import type { UserJSON } from "@/modules/auth/auth.types.js";
import jwt from "jsonwebtoken";

export class SecurityLayer {

    /** 
     * Hash password with explicit salt
     * @param password 
     * @returns string of hashed password
     */

    async hashPassword(password: string): Promise<string> {
        const saltRounds = 10;
        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(password, salt);
        return hashedPassword;
    }

    /** 
     * Compare plain password with hash
     * @param password 
     * @param hash 
     * @returns boolean
     */

    async comparePassword(password: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(password, hash);
    }


    async generateAccessToken(user: Omit<UserJSON, "password">): Promise<string> {
        return jwt.sign(user, process.env.JWT_SECRET!, { expiresIn: "1h" });
    }

    async generateRefreshToken(user: Omit<UserJSON, "password">): Promise<string> {
        return jwt.sign(user, process.env.REFRESH_SECRET!, { expiresIn: "7d" });
    }

    async verifyAccessToken(token: string): Promise<Omit<UserJSON, "password">> {
        return jwt.verify(token, process.env.JWT_SECRET!) as Omit<UserJSON, "password">;
    }

    async verifyRefreshToken(token: string): Promise<Omit<UserJSON, "password">> {
        return jwt.verify(token, process.env.REFRESH_SECRET!) as Omit<UserJSON, "password">;
    }

    async decodeToken(token: string): Promise<Omit<UserJSON, "password">> {
        return jwt.decode(token) as Omit<UserJSON, "password">;
    }

    async extractTokenFromHeader(header: string): Promise<string> {
        const token = header.split(" ")[1];
        return token!;
    }

    async extractTokenFromCookie(cookie: string): Promise<string> {
        const token = cookie.split("=")[1];
        return token!;
    }
}


export class SchemaValidator {
    private ajv: Ajv;

    constructor() {
        this.ajv = new Ajv({ allErrors: true, strict: false });
    }

    validate(schema: Schema, data: any): { valid: boolean; errors?: any } {
        const validate = this.ajv.compile(schema);
        const valid = validate(data);
        return {
            valid,
            errors: valid ? undefined : validate.errors
        };
    }
}