// src/core/transactions/TransactionManager.ts

import { getDatabase, getSqliteInstance } from '../../infrastructure/database';
import { Logger } from '../logging/Logger';
import { SagaStep } from './types';

/**
 * TransactionManager
 * Manages atomic SQLite operations and distributed Sagas with rollbacks.
 * Uses a singleton pattern for consistent state across the application.
 */
export class TransactionManager {
    private static instance: TransactionManager;
    private inTransactionState: boolean = false;
    private transactionDepth: number = 0;
    private rollbackActions: Array<{ action: () => Promise<void>, description: string }> = [];

    private constructor() { }

    public static getInstance(): TransactionManager {
        if (!TransactionManager.instance) {
            TransactionManager.instance = new TransactionManager();
        }
        return TransactionManager.instance;
    }

    /**
     * Executes an operation within a SQLite transaction.
     * Supports nesting using SQLite's SAVEPOINT mechanism.
     */
    async executeTransaction<T>(operation: () => Promise<T>): Promise<T> {
        if (this.transactionDepth > 0) {
            // Nested transaction: use savepoint
            const savepointName = `sp_${this.transactionDepth}_${Date.now()}`;
            this.transactionDepth++;

            try {
                this.createSavepoint(savepointName);
                const result = await operation();
                this.releaseSavepoint(savepointName);
                this.transactionDepth--;
                return result;
            } catch (error) {
                this.rollbackToSavepoint(savepointName);
                this.transactionDepth--;
                throw error;
            }
        }

        // Outer transaction
        await this.beginTransaction();
        try {
            const result = await operation();
            await this.commit();
            return result;
        } catch (error) {
            await this.rollback();
            throw error;
        }
    }

    private async beginTransaction(): Promise<void> {
        if (this.inTransactionState) {
            throw new Error('Transaction already in progress');
        }
        const sqlite = getSqliteInstance();
        sqlite.prepare('BEGIN').run();
        this.inTransactionState = true;
        this.transactionDepth = 1;
        this.rollbackActions = [];
    }

    private createSavepoint(name: string): void {
        const sqlite = getSqliteInstance();
        sqlite.prepare(`SAVEPOINT ${name}`).run();
        Logger.debug('TransactionManager', `Created savepoint: ${name}`);
    }

    private releaseSavepoint(name: string): void {
        const sqlite = getSqliteInstance();
        sqlite.prepare(`RELEASE SAVEPOINT ${name}`).run();
        Logger.debug('TransactionManager', `Released savepoint: ${name}`);
    }

    private rollbackToSavepoint(name: string): void {
        const sqlite = getSqliteInstance();
        try {
            sqlite.prepare(`ROLLBACK TO SAVEPOINT ${name}`).run();
            Logger.debug('TransactionManager', `Rolled back to savepoint: ${name}`);
        } catch (error) {
            Logger.error('TransactionManager', `Failed to rollback to savepoint: ${name}`, error);
            throw error;
        }
    }

    private async commit(): Promise<void> {
        if (!this.inTransactionState) {
            throw new Error('No transaction to commit');
        }
        const sqlite = getSqliteInstance();
        sqlite.prepare('COMMIT').run();
        this.inTransactionState = false;
        this.transactionDepth = 0;
        this.rollbackActions = [];
    }

    private async rollback(): Promise<void> {
        if (this.inTransactionState) {
            const sqlite = getSqliteInstance();
            try {
                sqlite.prepare('ROLLBACK').run();
            } catch (e) {
                Logger.error('TransactionManager', 'SQL Rollback failed', e);
            }
            this.inTransactionState = false;
            this.transactionDepth = 0;
        }

        // Execute compensating actions for external systems (Saga Pattern)
        if (this.rollbackActions.length > 0) {
            Logger.info('TransactionManager', `Executing ${this.rollbackActions.length} compensation actions...`);
            for (let i = this.rollbackActions.length - 1; i >= 0; i--) {
                const { action, description } = this.rollbackActions[i];
                try {
                    Logger.info('TransactionManager', `Compensating: ${description}`);
                    await action();
                } catch (e) {
                    Logger.error('TransactionManager', `Compensation failed: ${description}`, e);
                }
            }
            this.rollbackActions = [];
        }
    }

    /**
     * Register a compensating action to be run if the current transaction rolls back.
     * This is used for "undoing" external side effects like vector store additions.
     */
    addRollbackAction(action: () => Promise<void>, description: string): void {
        if (this.transactionDepth === 0) {
            Logger.warn('TransactionManager', 'Adding rollback action outside of transaction');
        }
        this.rollbackActions.push({ action, description });
    }

    /**
     * Executes a distributed saga (multi-step transaction).
     */
    async executeSaga<T>(steps: SagaStep<any>[]): Promise<T> {
        const completedSteps: SagaStep<any>[] = [];
        let result: any = null;

        try {
            for (const step of steps) {
                result = await step.execute(result);
                completedSteps.push(step);
            }
            return result;
        } catch (error) {
            Logger.error('TransactionManager', `Saga failed during step: ${completedSteps.length}`, error);
            // Run compensations in reverse order
            for (let i = completedSteps.length - 1; i >= 0; i--) {
                const step = completedSteps[i];
                try {
                    if (step.compensate) {
                        await step.compensate(result);
                    }
                } catch (rollbackError) {
                    Logger.error('TransactionManager', `CRITICAL: Saga compensation failed for ${step.name}`, rollbackError);
                }
            }
            throw error;
        }
    }
}
