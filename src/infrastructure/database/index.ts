import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '../../config/config';
import { ENV } from '../../config/env';
import { Logger } from '../../core/logging/Logger';

// Database file path - stored in root data directory
const DB_FILENAME = ENV.NODE_ENV === 'test' ? 'codified_test_v2.db' : 'codified_v2.db';
const DB_PATH = path.join(CONFIG.PATHS.DATA_DIR, DB_FILENAME);

let db: BetterSQLite3Database<typeof schema> | null = null;
let sqlite: Database.Database | null = null;

/**
 * Initialize the SQLite database connection
 */
export function initDatabase(dbPath: string = DB_PATH): BetterSQLite3Database<typeof schema> {
    if (db && dbPath === DB_PATH) return db;

    if (sqlite) {
        sqlite.close();
    }

    // Ensure directory exists
    if (!fs.existsSync(CONFIG.PATHS.DATA_DIR)) {
        fs.mkdirSync(CONFIG.PATHS.DATA_DIR, { recursive: true });
    }

    sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL'); // Better performance for concurrent reads
    sqlite.pragma('foreign_keys = ON');  // Enforce foreign keys

    db = drizzle(sqlite, { schema });

    // Create tables if they don't exist
    sqlite.exec(`
        CREATE TABLE IF NOT EXISTS nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT DEFAULT 'concept',
            content TEXT,
            user_id TEXT NOT NULL,
            embedding_id TEXT,
            metadata TEXT,
            created_at INTEGER NOT NULL DEFAULT (unixepoch()),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
            status TEXT DEFAULT 'PENDING'
        );
        
        CREATE TABLE IF NOT EXISTS edges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            target_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            type TEXT NOT NULL DEFAULT 'RELATED_TO',
            weight REAL DEFAULT 1.0,
            user_id TEXT NOT NULL,
            metadata TEXT,
            created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        
        CREATE TABLE IF NOT EXISTS memory_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            description TEXT,
            metadata TEXT,
            user_id TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        
        CREATE TABLE IF NOT EXISTS embeddings (
            id TEXT PRIMARY KEY,
            node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
            user_id TEXT NOT NULL,
            model TEXT NOT NULL,
            created_at INTEGER DEFAULT (unixepoch())
        );
        
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            token_count INTEGER,
            is_summarized INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL DEFAULT (unixepoch())
        );

        CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            capabilities TEXT,
            user_id TEXT,
            created_at INTEGER DEFAULT (unixepoch()),
            last_seen INTEGER DEFAULT (unixepoch())
        );

        CREATE UNIQUE INDEX IF NOT EXISTS uid_nodes_name_user ON nodes(name, user_id);
        CREATE INDEX IF NOT EXISTS idx_nodes_created ON nodes(created_at);
        CREATE INDEX IF NOT EXISTS idx_nodes_user ON nodes(user_id);
        CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
        CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
        CREATE INDEX IF NOT EXISTS idx_edges_user ON edges(user_id);
        CREATE INDEX IF NOT EXISTS idx_events_created ON memory_events(created_at);
        CREATE INDEX IF NOT EXISTS idx_messages_summarized ON messages(is_summarized);
        CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    `);

    // Ensure metadata columns exist for migration from older versions
    try { sqlite.exec(`ALTER TABLE nodes ADD COLUMN metadata TEXT;`); } catch (e) { }
    try { sqlite.exec(`ALTER TABLE nodes ADD COLUMN status TEXT DEFAULT 'PENDING';`); } catch (e) { }
    try { sqlite.exec(`ALTER TABLE edges ADD COLUMN metadata TEXT;`); } catch (e) { }
    try { sqlite.exec(`ALTER TABLE memory_events ADD COLUMN metadata TEXT;`); } catch (e) { }

    Logger.info('DB', `SQLite database initialized at: ${dbPath}`);
    return db;
}

/**
 * Get the database instance
 */
export function getDatabase(): BetterSQLite3Database<typeof schema> {
    if (!db) {
        return initDatabase();
    }
    return db;
}

/**
 * Get the raw SQLite instance (for raw queries)
 */
export function getSqliteInstance(): Database.Database {
    if (!sqlite) {
        initDatabase();
    }
    return sqlite!;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
    if (sqlite) {
        sqlite.close();
        sqlite = null;
        db = null;
        Logger.info('DB', 'Database connection closed');
    }
}

export { schema };
export { nodes, edges, embeddings, messages } from './schema';
