import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import * as fs from 'fs';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------
export interface VectorRecord {
    id: string;
    vector: number[];
    text: string;
    userId: string;
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
        if (!this.db) {
            const dbPath = path.join(process.cwd(), 'data', 'lancedb');
            if (!fs.existsSync(dbPath)) {
                fs.mkdirSync(dbPath, { recursive: true });
            }
            this.db = await lancedb.connect(dbPath);
        }
        return this.db;
    }

    private async getTable(): Promise<lancedb.Table | null> {
        const db = await this.getDb();
        const existingTableNames = await db.tableNames();

        if (existingTableNames.includes(this.tableName)) {
            return await db.openTable(this.tableName);
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
            console.warn(`Transaction ${transactionId} not found`);
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
            console.error(`Failed to rollback transaction ${transactionId}:`, error);
            return false;
        }
    }

    /**
     * Simple add without transaction tracking (for internal use).
     */
    public async addVectors(records: VectorRecord[]): Promise<void> {
        if (records.length === 0) return;

        const db = await this.getDb();
        const existingTableNames = await db.tableNames();

        if (existingTableNames.includes(this.tableName)) {
            const table = await db.openTable(this.tableName);
            await table.add(records);
        } else {
            await db.createTable(this.tableName, records);
        }
    }

    /**
     * Deletes vectors by ID (Compensation action for Saga rollback).
     */
    public async deleteVectors(ids: string[]): Promise<void> {
        if (ids.length === 0) return;

        const table = await this.getTable();
        if (!table) return;

        // Escape IDs properly to prevent injection
        const idList = ids.map(id => `'${id.replace(/'/g, "''")}'`).join(', ');
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

        // Build filter conditions
        const conditions: string[] = [`userId = '${userId.replace(/'/g, "''")}'`];

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
