const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILES = ['codified_v2.db', 'codified_test_v2.db'];

DB_FILES.forEach(dbFile => {
    const dbPath = path.join(DATA_DIR, dbFile);
    if (!fs.existsSync(dbPath)) {
        console.log(`Database ${dbFile} not found, skipping.`);
        return;
    }

    console.log(`Patching ${dbFile}...`);
    const db = new Database(dbPath);

    const tables = ['nodes', 'edges', 'memory_events'];

    tables.forEach(table => {
        try {
            db.prepare(`ALTER TABLE ${table} ADD COLUMN metadata TEXT`).run();
            console.log(`  Added 'metadata' column to ${table}.`);
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log(`  Column 'metadata' already exists in ${table}.`);
            } else {
                console.error(`  Error patching ${table}:`, e.message);
            }
        }
    });

    db.close();
});
console.log('Patching complete.');
