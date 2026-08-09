import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@g64/database';
import { DATABASE, type Database } from '../../infrastructure/database/database.module.js';
import { verifyDigest } from './auth.crypto.js';
import type { AuditEvent, OtpPurpose } from './auth.types.js';

export interface Challenge {
  id: string;
  email: string;
  purpose: OtpPurpose;
  codeDigest: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attemptCount: number;
}
export interface StoredUser {
  id: string;
  email: string;
  createdAt: Date;
  emailVerifiedAt: Date | null;
}
interface SessionUserRow {
  session_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  id: string;
  email: string;
  created_at: Date;
  email_verified_at: Date | null;
}
export type AuthenticationResult =
  | { status: 'authenticated'; user: StoredUser; sessionId: string; purpose: OtpPurpose }
  | { status: 'account_exists' }
  | { status: 'invalid' }
  | { status: 'limited' };

@Injectable()
export class AuthRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async userByEmail(email: string): Promise<StoredUser | null> {
    const rows = await this.database.client<
      StoredUser[]
    >`SELECT id,email,created_at AS "createdAt",email_verified_at AS "emailVerifiedAt" FROM users WHERE email=${email} LIMIT 1`;
    return rows[0] ?? null;
  }

  async createChallenge(
    id: string,
    email: string,
    purpose: OtpPurpose,
    digest: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.database
      .client`INSERT INTO auth_challenges (id,email,purpose,code_digest,expires_at) VALUES (${id},${email},${purpose},${digest},${expiresAt})`;
  }

  async consumeAndAuthenticate(
    id: string,
    digest: string,
    maxAttempts: number,
    tokenHash: string,
    sessionExpiresAt: Date,
  ): Promise<AuthenticationResult> {
    return this.database.client.begin(async (sql: DatabaseTransaction) => {
      const challenges = await sql<
        Challenge[]
      >`SELECT id,email,purpose,code_digest AS "codeDigest",expires_at AS "expiresAt",consumed_at AS "consumedAt",attempt_count AS "attemptCount" FROM auth_challenges WHERE id=${id} FOR UPDATE`;
      const challenge = challenges[0];

      if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) {
        return { status: 'invalid' };
      }
      if (challenge.attemptCount >= maxAttempts) return { status: 'limited' };

      if (!verifyDigest(challenge.codeDigest, digest)) {
        const nextAttemptCount = challenge.attemptCount + 1;
        await sql`UPDATE auth_challenges SET attempt_count=${nextAttemptCount} WHERE id=${id}`;
        return { status: nextAttemptCount >= maxAttempts ? 'limited' : 'invalid' };
      }

      const consumed = await sql<
        { id: string }[]
      >`UPDATE auth_challenges SET consumed_at=now() WHERE id=${id} AND consumed_at IS NULL RETURNING id`;
      if (!consumed[0]) return { status: 'invalid' };

      let userRows = await sql<
        StoredUser[]
      >`SELECT id,email,created_at AS "createdAt",email_verified_at AS "emailVerifiedAt" FROM users WHERE email=${challenge.email} FOR UPDATE`;

      if (challenge.purpose === 'signup' && userRows[0]) return { status: 'account_exists' };
      if (challenge.purpose === 'login' && !userRows[0]) return { status: 'invalid' };

      if (!userRows[0])
        userRows = await sql<
          StoredUser[]
        >`INSERT INTO users(email,email_verified_at,last_login_at) VALUES (${challenge.email},now(),now()) RETURNING id,email,created_at AS "createdAt",email_verified_at AS "emailVerifiedAt"`;
      else
        await sql`UPDATE users SET last_login_at=now(),updated_at=now() WHERE id=${userRows[0].id}`;

      const sessions = await sql<
        { id: string }[]
      >`INSERT INTO sessions(user_id,token_hash,expires_at) VALUES (${userRows[0]!.id},${tokenHash},${sessionExpiresAt}) RETURNING id`;
      return {
        status: 'authenticated',
        user: userRows[0]!,
        sessionId: sessions[0]!.id,
        purpose: challenge.purpose,
      };
    });
  }

  async session(tokenHash: string): Promise<{ sessionId: string; user: StoredUser } | null> {
    const rows = await this.database.client<
      SessionUserRow[]
    >`SELECT s.id AS session_id,s.expires_at,s.revoked_at,u.id,u.email,u.created_at,u.email_verified_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=${tokenHash} LIMIT 1`;
    const row = rows[0];
    if (!row || row.revoked_at || row.expires_at <= new Date()) return null;
    await this.database.client`UPDATE sessions SET last_seen_at=now() WHERE id=${row.session_id}`;
    return {
      sessionId: row.session_id,
      user: {
        id: row.id,
        email: row.email,
        createdAt: row.created_at,
        emailVerifiedAt: row.email_verified_at,
      },
    };
  }

  async revoke(tokenHash: string): Promise<string | null> {
    const rows = await this.database.client<
      { user_id: string }[]
    >`UPDATE sessions SET revoked_at=now() WHERE token_hash=${tokenHash} AND revoked_at IS NULL RETURNING user_id`;
    return rows[0]?.user_id ?? null;
  }

  async audit(
    event: AuditEvent,
    subjectHash: string | null,
    userId: string | null = null,
  ): Promise<void> {
    await this.database
      .client`INSERT INTO auth_audit_events(event,subject_hash,user_id) VALUES (${event},${subjectHash},${userId})`;
  }

  async ready(): Promise<void> {
    await this.database.client`SELECT 1`;
  }
}
