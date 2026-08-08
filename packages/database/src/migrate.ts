import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from './index';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const database = createDatabase(url);
await migrate(database.db, { migrationsFolder: 'drizzle' });
await database.close();
console.log('Database migrations complete.');
