// src/core/transactions/types.ts

/**
 * Represents a single step in a Saga transaction.
 */
export interface SagaStep<T = any> {
    name: string;
    // The main operation to execute
    execute: (input: any) => Promise<T>;
    // The compensation logic to run if the Saga fails later
    compensate?: (result: T) => Promise<void>;
}

/**
 * State of a Saga transaction.
 */
export interface SagaState {
    id: string;
    status: 'PENDING' | 'COMPLETED' | 'ROLLING_BACK' | 'ROLLED_BACK' | 'FAILED';
    results: Map<string, any>;
    errors: Error[];
}
