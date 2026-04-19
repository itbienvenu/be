import { AuthRepository } from "./auth.repository.js";
import type { UserJSON, LoginJSON, LoginResponseJSON, RegisterResponseJSON, RefreshTokenResponse } from "./auth.types.js";
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
        
        // Ensure _id is a string in the payload and response
        const userId = userExists._id!.toString();

        return {
            success: true,
            message: "User logged in successfully",
            data: {
                accessToken:  await this.securityLayer.generateAccessToken({ ...payload, _id: userId } as any),
                refreshToken: await this.securityLayer.generateRefreshToken({ ...payload, _id: userId } as any),
                user: {
                    _id:   userId,
                    name:  userExists.name,
                    email: userExists.email,
                    role:  userExists.role
                }
            }
        }
    }

    async refresh(refreshToken: string): Promise<RefreshTokenResponse | ApiErrorResponse> {
        try {
            // Verify the refresh token — throws if expired or tampered
            const payload = await this.securityLayer.verifyRefreshToken(refreshToken);

            // Fetch fresh user data — rejects deleted/disabled accounts and ensures up-to-date role
            const user = await this.authRepository.findById((payload as any)._id);
            if (!user) {
                return { success: false, message: "Invalid or expired refresh token" };
            }

            const { password: _, ...userPayload } = user;
            const userId = user._id!.toString();

            // Issue a new short-lived access token from current DB state
            const accessToken = await this.securityLayer.generateAccessToken({ ...userPayload, _id: userId } as any);
            return {
                success: true,
                message: "Access token refreshed",
                data: { accessToken }
            };
        } catch (err: any) {
            logger.error("REFRESH_TOKEN_ERROR", err.message);
            return { success: false, message: "Invalid or expired refresh token" };
        }
    }

}