import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
export const users = pgTable('users', { id: uuid('id').defaultRandom().primaryKey(), email: varchar('email', { length: 320 }).notNull(), createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull() }, (table) => [uniqueIndex('users_email_unique').on(table.email)]);
export type User = typeof users.$inferSelect;
