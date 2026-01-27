import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite connection with WAL mode for performance
const sqlite = new Database(path.join(dataDir, 'remem.db'));
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON'); // Critical for Graph Integrity

export const db = drizzle(sqlite, { schema });

export const closeDatabase = () => {
    console.log('Closing database connection...');
    sqlite.close();
};

// Handle process termination ensuring DB closure
process.on('SIGINT', () => {
    closeDatabase();
    process.exit(0);
});
process.on('SIGTERM', () => {
    closeDatabase();
    process.exit(0);
});
