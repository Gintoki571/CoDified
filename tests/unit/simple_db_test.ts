// tests/unit/simple_db_test.ts
import { initDatabase, getDatabase, getSqliteInstance, closeDatabase } from '../../src/infrastructure/database/index';
import path from 'path';
import fs from 'fs';

async function test() {
    console.log("Starting simple DB test...");
    const testDbPath = path.join(process.cwd(), 'data', 'simple_test.db');

    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }

    try {
        const db = initDatabase(testDbPath);
        console.log("✅ Database initialized");

        const sqlite = getSqliteInstance();
        const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        console.log("Found tables:", tables.map((t: any) => t.name).join(", "));

        if (tables.length > 0) {
            console.log("✅ Tables created successfully");
        } else {
            console.log("❌ No tables found!");
        }

        const fkStatus = sqlite.pragma('foreign_keys', { simple: true });
        console.log("Foreign keys enabled:", fkStatus === 1 ? "✅ Yes" : "❌ No");

        const journalMode = sqlite.pragma('journal_mode', { simple: true });
        console.log("Journal mode:", journalMode === 'wal' ? "✅ WAL" : `❌ ${journalMode}`);

        closeDatabase();
        console.log("✅ Database closed");
    } catch (error) {
        console.error("❌ Test failed:", error);
    } finally {
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    }
}

test();
