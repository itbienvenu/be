import { Request, Response, NextFunction } from "express";

/**
 * Simple in-memory rate limiter for protecting endpoints from spam
 * @param windowMs - Time window in milliseconds (default: 60 seconds)
 * @param maxRequests - Maximum requests per window (default: 30)
 * @returns Express middleware function
 *
 * @example
 * router.post("/manual-entry", rateLimitMiddleware(60000, 10), controller.createJobManually);
 */
export function rateLimitMiddleware(windowMs: number = 60000, maxRequests: number = 30) {
    const requestCounts = new Map<string, { count: number; resetTime: number }>();

    // Cleanup old entries every 5 minutes
    setInterval(() => {
        const now = Date.now();
        for (const [key, data] of requestCounts.entries()) {
            if (data.resetTime < now) {
                requestCounts.delete(key);
            }
        }
    }, 5 * 60 * 1000);

    return (req: Request, res: Response, next: NextFunction) => {
        // Use user ID if authenticated, otherwise use IP address
        const identifier = (req as any).user?._id || req.ip || "unknown";
        const now = Date.now();

        let clientData = requestCounts.get(identifier);

        // Initialize or reset if window expired
        if (!clientData || clientData.resetTime < now) {
            clientData = { count: 0, resetTime: now + windowMs };
            requestCounts.set(identifier, clientData);
        }

        // Increment request count
        clientData.count += 1;

        // Set rate limit headers
        res.setHeader("X-RateLimit-Limit", maxRequests);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - clientData.count));
        res.setHeader("X-RateLimit-Reset", new Date(clientData.resetTime).toISOString());

        // Check if limit exceeded
        if (clientData.count > maxRequests) {
            const retryAfterSeconds = Math.ceil((clientData.resetTime - now) / 1000);
            return res.status(429).json({
                success: false,
                message: "Too many requests. Please try again later.",
                retryAfter: retryAfterSeconds
            });
        }

        next();
    };
}

/**
 * Rate limiter specifically for job creation endpoints
 * 10 requests per minute (60 seconds)
 */
export const jobCreationRateLimiter = rateLimitMiddleware(60000, 10);
