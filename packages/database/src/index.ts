import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
export * from './schema.js';
export type DatabaseTransaction = postgres.TransactionSql;
export function createDatabase(url: string) {
  const client = postgres(url, { max: 10 });
  return { db: drizzle(client), client, close: () => client.end() };
}
