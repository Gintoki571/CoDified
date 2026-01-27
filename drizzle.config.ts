import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/infrastructure/database/schema.ts',
    out: './drizzle',
    dialect: 'sqlite',
    dbCredentials: {
        url: 'file:./data/remem.db',
    },
    verbose: true,
    strict: true,
});
