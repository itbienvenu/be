import type { Request, Response, NextFunction } from "express";

/**
 * Simple in-memory rate limiter for protecting endpoints from spam
 * Uses lazy expiration to avoid memory leaks from persistent setInterval timers.
 * Expired entries are cleaned up during request processing, not by background intervals.
 *
 * @param windowMs - Time window in milliseconds (default: 60 seconds)
 * @param maxRequests - Maximum requests per window (default: 30)
 * @returns Express middleware function
 *
 * @example
 * router.post("/manual-entry", rateLimitMiddleware(60000, 10), controller.createJobManually);
 */
export function rateLimitMiddleware(windowMs: number = 60000, maxRequests: number = 30) {
    const requestCounts = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
        const now = Date.now();
        
        // Lazy cleanup: Remove expired entries during request processing
        // This avoids memory leaks from persistent timers when factory is called multiple times
        for (const [key, data] of requestCounts.entries()) {
            if (data.resetTime < now) {
                requestCounts.delete(key);
            }
        }

        // Use user ID if authenticated, otherwise use IP address
        // Coerce to string to ensure stable Map keys (ObjectId, IPs, etc. all become strings)
        const identifier = String((req as any).user?._id || req.ip || "unknown");

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
