// src/core/security/types.ts

export interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

export interface UserRateLimitState {
    requests: number;
    windowStart: number;
}
