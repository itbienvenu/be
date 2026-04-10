import { AuthRepository } from "./auth.repository.js";
import type { UserJSON, LoginJSON, LogoutJSON, LoginResponseJSON, RegisterResponseJSON } from "./auth.types.js";
import type { ApiErrorResponse } from "@/shared/types/global.d.ts";
import { SecurityLayer } from "@/shared/utils/security.js";
import logger from "@/shared/utils/logger.js";

export class AuthService {
    constructor(private readonly authRepository: AuthRepository) { }

    private securityLayer: SecurityLayer = new SecurityLayer();

    async register(user: UserJSON): Promise<RegisterResponseJSON | ApiErrorResponse> {
        const userExists = await this.authRepository.findByEmail(user.email);
        if (userExists) {
            return { success: false, message: "User already exists" };
        }
        await this.authRepository.register(user);
        return {
            success: true,
            message: "User registered successfully",
            data: {
                name: user.name,
                email: user.email,
                role: user.role
            }
        };
    }

    async login(user: LoginJSON): Promise<LoginResponseJSON | ApiErrorResponse> {
        const userExists = await this.authRepository.findByEmail(user.email);
        if (!userExists) {
            return { success: false, message: "User not found" };
        }
        const isPasswordValid = await this.securityLayer.comparePassword(user.password, userExists.password);
        if (!isPasswordValid) {
            logger.error("Invalid credentials for user:", user.email);
            return { success: false, message: "Invalid credentials" };
        }

        const { password: _, ...payload } = userExists;

        return {
            success: true,
            message: "User logged in successfully",
            data: {
                token: await this.securityLayer.generateAccessToken(payload),
                user: {
                    name: userExists.name,
                    email: userExists.email,
                    role: userExists.role
                }
            }
        }

    }

}