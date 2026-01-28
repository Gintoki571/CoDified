import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getDatabase, closeDatabase } from '../infrastructure/database';

async function runMigrations() {
    console.log('📦 Running Database Migrations...');
    try {
        await migrate(getDatabase() as any, { migrationsFolder: './drizzle' });
        console.log('✅ Migrations applied successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        closeDatabase();
    }
}

runMigrations();
