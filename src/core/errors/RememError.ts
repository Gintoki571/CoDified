// src/core/errors/RememError.ts

import { ErrorContext } from './ErrorContext';

/**
 * Base error class for all CoDified/ReMem related errors.
 * Provides structured metadata and user-friendly formatting.
 */
export class RememError extends Error {
    public readonly context: ErrorContext;
    public readonly timestamp: number;

    constructor(message: string, context: ErrorContext = {}) {
        super(message);
        this.name = 'RememError';
        this.context = context;
        this.timestamp = Date.now();

        // Ensure proper stack trace in Node.js
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Converts the error to a plain object for JSON serialization.
     */
    public toJSON() {
        return {
            name: this.name,
            message: this.message,
            timestamp: this.timestamp,
            context: this.context,
            stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
        };
    }

    /**
     * Formats a message suitable for end-users.
     */
    public toUserFriendly(): string {
        let msg = `[${this.context.code || 'ERROR'}] ${this.message}`;
        if (this.context.suggestion) {
            msg += `\nTip: ${this.context.suggestion}`;
        }
        return msg;
    }

    /**
     * Detailed string representation for internal logging.
     */
    public toDebugString(): string {
        return JSON.stringify(this.toJSON(), null, 2);
    }
}
