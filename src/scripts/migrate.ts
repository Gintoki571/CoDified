import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getDatabase, closeDatabase } from '../infrastructure/database';

import { Logger } from '../core/logging/Logger';

async function runMigrations() {
    Logger.info('Migration', '📦 Running Database Migrations...');
    try {
        await migrate(getDatabase() as any, { migrationsFolder: './drizzle' });
        Logger.info('Migration', '✅ Migrations applied successfully!');
    } catch (err) {
        Logger.error('Migration', '❌ Migration failed:', err);
        process.exit(1);
    } finally {
        closeDatabase();
    }
}

runMigrations();
