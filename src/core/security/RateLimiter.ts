// src/core/security/RateLimiter.ts

import { CONFIG } from '../../config/config';
import { UserRateLimitState } from './types';
import { Logger } from '../logging/Logger';

/**
 * RateLimiter
 * Simple in-memory rate limiter for user requests.
 * Uses a fixed window algorithm.
 */
export class RateLimiter {
    private static instance: RateLimiter;
    private userStates: Map<string, UserRateLimitState> = new Map();

    private constructor() { }

    public static getInstance(): RateLimiter {
        if (!RateLimiter.instance) {
            RateLimiter.instance = new RateLimiter();
        }
        return RateLimiter.instance;
    }

    /**
     * Checks if a user has exceeded their rate limit.
     * Consumes one request token if within limit.
     */
    public consume(userId: string): boolean {
        const now = Date.now();
        const config = CONFIG.RATE_LIMIT;
        let state = this.userStates.get(userId);

        // Reset if window has passed
        if (!state || (now - state.windowStart) > config.WINDOW_MS) {
            state = {
                requests: 1,
                windowStart: now
            };
            this.userStates.set(userId, state);
            return true;
        }

        // Check limit
        if (state.requests >= config.MAX_REQUESTS) {
            Logger.warn('RateLimiter', `User ${userId} exceeded rate limit`, {
                requests: state.requests,
                limit: config.MAX_REQUESTS
            });
            return false;
        }

        state.requests++;
        return true;
    }

    /**
     * Gets remaining requests for a user.
     */
    public getRemaining(userId: string): number {
        const now = Date.now();
        const config = CONFIG.RATE_LIMIT;
        const state = this.userStates.get(userId);

        if (!state || (now - state.windowStart) > config.WINDOW_MS) {
            return config.MAX_REQUESTS;
        }

        return Math.max(0, config.MAX_REQUESTS - state.requests);
    }
}
