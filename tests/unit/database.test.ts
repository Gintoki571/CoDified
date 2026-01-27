// tests/unit/database.test.ts

import { initDatabase, getDatabase, getSqliteInstance, closeDatabase } from '../../src/infrastructure/database/index';
import { nodes } from '../../src/infrastructure/database/schema';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

describe('Database Lifecycle', () => {
    const testDbPath = path.join(process.cwd(), 'data', 'test_lifecycle.db');

    beforeAll(() => {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    afterAll(() => {
        closeDatabase();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    it('should initialize the database and create tables', () => {
        const db = initDatabase(testDbPath);
        expect(db).toBeDefined();

        const sqlite = getSqliteInstance();
        const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        const tableNames = tables.map((t: any) => t.name);

        expect(tableNames).toContain('nodes');
        expect(tableNames).toContain('edges');
        expect(tableNames).toContain('embeddings');
        expect(tableNames).toContain('messages');
    });

    it('should enforce foreign keys', () => {
        const sqlite = getSqliteInstance();
        const fkStatus = sqlite.pragma('foreign_keys', { simple: true });
        expect(fkStatus).toBe(1);
    });

    it('should enable WAL mode', () => {
        const sqlite = getSqliteInstance();
        const journalMode = sqlite.pragma('journal_mode', { simple: true });
        expect(journalMode).toBe('wal');
    });

    it('should release connection on close', () => {
        closeDatabase();
        // Since sqlite is null after closeDatabase, we can't check it directly
        // but it shouldn't throw errors
    });
});
