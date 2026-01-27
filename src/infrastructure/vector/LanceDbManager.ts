import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import * as fs from 'fs';

export interface VectorRecord {
    id: string;
    vector: number[];
    text: string;
    userId: string;
    timestamp: number;
    metadata: string; // JSON string
}

export class LanceDbManager {
    private static instance: LanceDbManager;
    private db: lancedb.Connection | null = null;
    private tableName = 'memories';

    private constructor() { }

    public static getInstance(): LanceDbManager {
        if (!LanceDbManager.instance) {
            LanceDbManager.instance = new LanceDbManager();
        }
        return LanceDbManager.instance;
    }

    private async getDb() {
        if (!this.db) {
            const dbPath = path.join(process.cwd(), 'data', 'lancedb');
            if (!fs.existsSync(dbPath)) {
                fs.mkdirSync(dbPath, { recursive: true });
            }
            this.db = await lancedb.connect(dbPath);
        }
        return this.db;
    }

    private async getTable() {
        const db = await this.getDb();
        const existingTableNames = await db.tableNames();

        if (existingTableNames.includes(this.tableName)) {
            return await db.openTable(this.tableName);
        }

        // Return null if not created yet, or create dummy?
        // Better to initialize with schema if possible, but LanceDB creates on first data typically.
        // We will handle creation in 'add' if missing.
        return null;
    }

    /**
     * Adds vectors with "Saga" rollback support.
     * Returns the IDs added.
     */
    public async addVectors(records: VectorRecord[]): Promise<void> {
        const db = await this.getDb();
        const existingTableNames = await db.tableNames();

        if (existingTableNames.includes(this.tableName)) {
            const table = await db.openTable(this.tableName);
            await table.add(records);
        } else {
            // Create table with first batch
            await db.createTable(this.tableName, records);
        }
    }

    /**
     * Deletes vectors by ID (Compensation action for Saga rollback)
     */
    public async deleteVectors(ids: string[]): Promise<void> {
        const table = await this.getTable();
        if (!table) return;

        // LanceDB SQL-like deletion: DELETE FROM memories WHERE id IN (...)
        // Requires specific SQL syntax support or iteration
        // Current LanceDB Node API for delete: table.delete('id IN ("a", "b")')
        const idList = ids.map(id => `'${id}'`).join(', ');
        if (idList.length > 0) {
            await table.delete(`id IN (${idList})`);
        }
    }

    /**
     * Hybrid Semantic Search with Temporal Filter
     */
    public async search(
        queryVector: number[],
        userId: string,
        limit: number = 10,
        minTimestamp?: number
    ): Promise<VectorRecord[]> {
        const table = await this.getTable();
        if (!table) return [];

        let query = table.search(queryVector)
            .where(`userId = '${userId}'`) // Security: Mandatory User Isolation
            .limit(limit);

        if (minTimestamp) {
            query = query.where(`userId = '${userId}' AND timestamp > ${minTimestamp}`);
        }

        const results = await query.execute();
        return results as unknown as VectorRecord[];
    }
}
