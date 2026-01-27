// src/core/errors/ErrorContext.ts

/**
 * Metadata provided with an error to help with debugging and user guidance.
 */
export interface ErrorContext {
    code?: string;           // Machine-readable error code (e.g., 'DB001')
    operation?: string;      // The function or process that failed
    suggestion?: string;     // Helpful tip for the user or developer
    component?: string;      // The layer where the error occurred
    retryable?: boolean;     // Whether the operation can be retried
    details?: any;           // Original error or additional technical context
}
