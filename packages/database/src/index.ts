import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
export * from './schema';
export function createDatabase(url: string) { const client = postgres(url, { max: 10 }); return { db: drizzle(client), close: () => client.end() }; }
