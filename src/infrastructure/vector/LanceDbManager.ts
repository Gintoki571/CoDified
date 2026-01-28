import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import * as fs from 'fs';
import { Mutex } from 'async-mutex';
import { validateNodeName, escapeSqlString } from '../../core/validation';
import { CONFIG } from '../../config/config';
import { Logger } from '../../core/logging/Logger';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------
export interface VectorRecord {
    id: string;
    vector: number[];
    text: string;
    userid: string;
    timestamp: number;
    metadata: string; // JSON string
    [key: string]: unknown; // Index signature for LanceDB compatibility
}

export interface SearchResult extends VectorRecord {
    _distance: number; // Lower = more similar
}

export interface SagaTransaction {
    transactionId: string;
    vectorIds: string[];
    status: 'pending' | 'committed' | 'rolled_back';
    createdAt: number;
}

// -------------------------------------------------------------------------
// LanceDB Manager (Singleton)
// -------------------------------------------------------------------------
export class LanceDbManager {
    private static instance: LanceDbManager;
    private db: lancedb.Connection | null = null;
    private tableName = 'memories';
    private initMutex = new Mutex();

    // Caching for performance
    private tableCache: Map<string, lancedb.Table> = new Map();

    // In-memory transaction tracker for Saga pattern
    private pendingTransactions: Map<string, SagaTransaction> = new Map();

    private constructor() { }

    public static getInstance(): LanceDbManager {
        if (!LanceDbManager.instance) {
            LanceDbManager.instance = new LanceDbManager();
        }
        return LanceDbManager.instance;
    }

    private async getDb(): Promise<lancedb.Connection> {
        return await this.initMutex.runExclusive(async () => {
            if (!this.db) {
                // Use CONFIG.PATHS.DATA_DIR which is derived from __dirname, NOT process.cwd()
                const dbPath = path.join(CONFIG.PATHS.DATA_DIR, 'lancedb');
                if (!fs.existsSync(dbPath)) {
                    fs.mkdirSync(dbPath, { recursive: true });
                }
                this.db = await lancedb.connect(dbPath);
            }
            return this.db;
        });
    }

    private async getTable(): Promise<lancedb.Table | null> {
        if (this.tableCache.has(this.tableName)) {
            return this.tableCache.get(this.tableName)!;
        }

        const db = await this.getDb();
        const existingTableNames = await db.tableNames();

        if (existingTableNames.includes(this.tableName)) {
            const table = await db.openTable(this.tableName);
            this.tableCache.set(this.tableName, table);
            return table;
        }
        return null;
    }

    // -------------------------------------------------------------------------
    // Saga Pattern: Transaction Management (Step 12)
    // -------------------------------------------------------------------------

    /**
     * Adds vectors with Saga transaction tracking.
     * Returns a transaction object that can be used for rollback.
     */
    public async addVectorsWithRollback(
        records: VectorRecord[],
        transactionId: string
    ): Promise<SagaTransaction> {
        const transaction: SagaTransaction = {
            transactionId,
            vectorIds: records.map(r => r.id),
            status: 'pending',
            createdAt: Date.now()
        };

        this.pendingTransactions.set(transactionId, transaction);

        try {
            await this.addVectors(records);
            transaction.status = 'committed';
            return transaction;
        } catch (error) {
            transaction.status = 'rolled_back';
            throw error;
        }
    }

    /**
     * Rolls back a pending transaction by deleting its vectors.
     */
    public async rollbackTransaction(transactionId: string): Promise<boolean> {
        const transaction = this.pendingTransactions.get(transactionId);
        if (!transaction) {
            Logger.warn('LanceDB', `Transaction ${transactionId} not found`);
            return false;
        }

        if (transaction.status === 'rolled_back') {
            return true; // Already rolled back
        }

        try {
            await this.deleteVectors(transaction.vectorIds);
            transaction.status = 'rolled_back';
            return true;
        } catch (error) {
            Logger.error('LanceDB', `Failed to rollback transaction ${transactionId}:`, error);
            return false;
        }
    }

    /**
     * Simple add without transaction tracking (for internal use).
     */
    public async addVectors(records: VectorRecord[]): Promise<void> {
        if (records.length === 0) return;

        // Security: Validate node name if present in metadata/records
        for (const record of records) {
            if (record.nodeName) validateNodeName(record.nodeName as string);
        }

        const table = await this.getTable();

        if (table) {
            await table.add(records);
        } else {
            const db = await this.getDb();
            const newTable = await db.createTable(this.tableName, records);
            this.tableCache.set(this.tableName, newTable);
        }
    }

    /**
     * Deletes vectors by ID (Compensation action for Saga rollback).
     */
    public async deleteVectors(ids: string[]): Promise<void> {
        if (ids.length === 0) return;

        const table = await this.getTable();
        if (!table) return;

        // Escape IDs properly to prevent injection (defense in depth)
        const idList = ids.map(id => `'${escapeSqlString(id)}'`).join(', ');
        await table.delete(`id IN (${idList})`);
    }

    // -------------------------------------------------------------------------
    // Search with Temporal Filtering (Step 11)
    // -------------------------------------------------------------------------

    /**
     * Semantic Search with mandatory user isolation and optional temporal filter.
     * 
     * @param queryVector - The embedding vector to search for
     * @param userId - User ID for isolation (REQUIRED)
     * @param options - Search options
     */
    public async search(
        queryVector: number[],
        userId: string,
        options: {
            limit?: number;
            minTimestamp?: number;
            maxTimestamp?: number;
        } = {}
    ): Promise<SearchResult[]> {
        const table = await this.getTable();
        if (!table) return [];

        const { limit = 10, minTimestamp, maxTimestamp } = options;

        // Build filter conditions with escaping
        const safeUserId = escapeSqlString(userId);
        const conditions: string[] = [`userid = '${safeUserId}'`];

        if (minTimestamp !== undefined) {
            conditions.push(`timestamp >= ${minTimestamp}`);
        }
        if (maxTimestamp !== undefined) {
            conditions.push(`timestamp <= ${maxTimestamp}`);
        }

        const whereClause = conditions.join(' AND ');

        const results = await table
            .search(queryVector)
            .where(whereClause)
            .limit(limit)
            .toArray();

        return results as unknown as SearchResult[];
    }

    /**
     * Search for memories within a specific time window.
     * Useful for "What did we discuss last week?" queries.
     */
    public async searchInTimeWindow(
        queryVector: number[],
        userId: string,
        startTime: Date,
        endTime: Date,
        limit: number = 10
    ): Promise<SearchResult[]> {
        return this.search(queryVector, userId, {
            limit,
            minTimestamp: startTime.getTime(),
            maxTimestamp: endTime.getTime()
        });
    }
}
