// src/core/errors/errors.ts

import { RememError } from './RememError';
import { ErrorContext } from './ErrorContext';

/**
 * Thrown when input validation fails.
 */
export class ValidationError extends RememError {
    constructor(message: string, context: ErrorContext = {}) {
        super(message, {
            code: 'VALIDATION_ERROR',
            component: 'CORE_VALIDATION',
            ...context
        });
        this.name = 'ValidationError';
    }
}

/**
 * Thrown for database/storage operations.
 */
export class DatabaseError extends RememError {
    constructor(message: string, context: ErrorContext = {}) {
        super(message, {
            code: 'DATABASE_ERROR',
            component: 'INFRA_DB',
            ...context
        });
        this.name = 'DatabaseError';
    }
}

/**
 * Thrown when a requested resource (node, edge, memory) is not found.
 */
export class NotFoundError extends RememError {
    constructor(message: string, context: ErrorContext = {}) {
        super(message, {
            code: 'NOT_FOUND',
            component: 'APPLICATION',
            ...context
        });
        this.name = 'NotFoundError';
    }
}

/**
 * Thrown when an external API (LLM, Vector Store) fails.
 */
export class ExternalServiceError extends RememError {
    constructor(message: string, context: ErrorContext = {}) {
        super(message, {
            code: 'SERVICE_ERROR',
            component: 'INFRA_EXTERNAL',
            ...context
        });
        this.name = 'ExternalServiceError';
    }
}

/**
 * Thrown when concurrency constraints (mutex, locks) are violated.
 */
export class ConcurrencyError extends RememError {
    constructor(message: string, context: ErrorContext = {}) {
        super(message, {
            code: 'CONCURRENCY_ERROR',
            component: 'CORE_TRANSACTION',
            ...context
        });
        this.name = 'ConcurrencyError';
    }
}
