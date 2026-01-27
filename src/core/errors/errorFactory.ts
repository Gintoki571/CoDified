// src/core/errors/errorFactory.ts

import * as Errors from './errors';
import { ErrorContext } from './ErrorContext';

/**
 * Factory class to create consistent error instances across the application.
 */
export class ErrorFactory {
    static validation(message: string, context?: ErrorContext) {
        return new Errors.ValidationError(message, context);
    }

    static database(message: string, context?: ErrorContext) {
        return new Errors.DatabaseError(message, context);
    }

    static notFound(message: string, context?: ErrorContext) {
        return new Errors.NotFoundError(message, context);
    }

    static external(message: string, context?: ErrorContext) {
        return new Errors.ExternalServiceError(message, context);
    }

    static concurrency(message: string, context?: ErrorContext) {
        return new Errors.ConcurrencyError(message, context);
    }
}
