import {
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  index,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);

export const authChallenges = pgTable(
  'auth_challenges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 320 }).notNull(),
    purpose: varchar('purpose', { length: 16 }).notNull(),
    codeDigest: varchar('code_digest', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('auth_challenges_email_created_idx').on(table.email, table.createdAt),
    index('auth_challenges_expires_idx').on(table.expiresAt),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_idx').on(table.userId),
    index('sessions_expires_idx').on(table.expiresAt),
  ],
);

export const authAuditEvents = pgTable(
  'auth_audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    event: varchar('event', { length: 48 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    subjectHash: varchar('subject_hash', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('auth_audit_created_idx').on(table.createdAt),
    index('auth_audit_user_idx').on(table.userId),
  ],
);

export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    family: varchar('family', { length: 16 }).notNull(),
    address: varchar('address', { length: 42 }).notNull(),
    derivationPath: varchar('derivation_path', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('wallets_user_family_unique').on(table.userId, table.family),
    uniqueIndex('wallets_address_unique').on(table.address),
    index('wallets_user_idx').on(table.userId),
  ],
);

export const walletRegistrationChallenges = pgTable(
  'wallet_registration_challenges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    family: varchar('family', { length: 16 }).notNull(),
    address: varchar('address', { length: 42 }).notNull(),
    message: varchar('message', { length: 1024 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('wallet_registration_user_created_idx').on(table.userId, table.createdAt),
    index('wallet_registration_expires_idx').on(table.expiresAt),
  ],
);

export type User = typeof users.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
