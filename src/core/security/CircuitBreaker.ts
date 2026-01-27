// src/core/security/CircuitBreaker.ts

import { Logger } from '../logging/Logger';

export enum CircuitState {
    CLOSED,    // Normal operation
    OPEN,      // Failing, stop requests
    HALF_OPEN  // Testing if recovered
}

export interface CircuitBreakerConfig {
    failureThreshold: number;
    resetTimeoutMs: number;
}

/**
 * CircuitBreaker
 * Prevents cascading failures by stopping calls to a failing component.
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private config: CircuitBreakerConfig;
    private name: string;

    constructor(name: string, config: CircuitBreakerConfig = { failureThreshold: 3, resetTimeoutMs: 30000 }) {
        this.name = name;
        this.config = config;
    }

    /**
     * Executes the provided function with circuit breaker protection.
     */
    public async execute<T>(action: () => Promise<T>): Promise<T> {
        this.updateState();

        if (this.state === CircuitState.OPEN) {
            throw new Error(`Circuit breaker [${this.name}] is OPEN. Request rejected.`);
        }

        try {
            const result = await action();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    private updateState(): void {
        if (this.state === CircuitState.OPEN) {
            const now = Date.now();
            if (now - this.lastFailureTime > this.config.resetTimeoutMs) {
                this.state = CircuitState.HALF_OPEN;
                Logger.info('CircuitBreaker', `Circuit [${this.name}] moved to HALF_OPEN`);
            }
        }
    }

    private onSuccess(): void {
        if (this.state === CircuitState.HALF_OPEN || this.state === CircuitState.OPEN) {
            Logger.info('CircuitBreaker', `Circuit [${this.name}] recovered (CLOSED)`);
        }
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.config.failureThreshold) {
            this.state = CircuitState.OPEN;
            Logger.error('CircuitBreaker', `Circuit [${this.name}] is now OPEN after ${this.failureCount} failures`);
        }
    }

    public getState(): CircuitState {
        return this.state;
    }
}
