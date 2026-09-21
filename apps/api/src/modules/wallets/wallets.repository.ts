import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseTransaction } from '@g64/database';
import { DATABASE, type Database } from '../../infrastructure/database/database.module.js';

export interface StoredWallet {
  id: string;
  userId: string;
  family: 'evm';
  address: string;
  derivationPath: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface StoredWalletChallenge {
  id: string;
  userId: string;
  family: 'evm';
  address: string;
  message: string;
  expiresAt: Date | string;
  consumedAt: Date | string | null;
}

export type RegisterWalletResult =
  | { status: 'registered'; wallet: StoredWallet }
  | { status: 'invalid_challenge' }
  | { status: 'wallet_exists' }
  | { status: 'address_exists' };

@Injectable()
export class WalletsRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async walletForUser(userId: string): Promise<StoredWallet | null> {
    const rows = await this.database.client<StoredWallet[]>`
      SELECT id,user_id AS "userId",family,address,derivation_path AS "derivationPath",
             created_at AS "createdAt",updated_at AS "updatedAt"
      FROM wallets
      WHERE user_id=${userId} AND family='evm'
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async createChallenge(input: {
    id: string;
    userId: string;
    address: string;
    message: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.client`
      INSERT INTO wallet_registration_challenges
        (id,user_id,family,address,message,expires_at)
      VALUES
        (${input.id},${input.userId},'evm',${input.address},${input.message},${input.expiresAt.toISOString()})
    `;
  }

  async challenge(id: string, userId: string): Promise<StoredWalletChallenge | null> {
    const rows = await this.database.client<StoredWalletChallenge[]>`
      SELECT id,user_id AS "userId",family,address,message,
             expires_at AS "expiresAt",consumed_at AS "consumedAt"
      FROM wallet_registration_challenges
      WHERE id=${id} AND user_id=${userId} AND family='evm'
        AND consumed_at IS NULL AND expires_at > now()
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async consumeAndRegister(
    challengeId: string,
    userId: string,
    address: string,
    derivationPath: string,
  ): Promise<RegisterWalletResult> {
    return this.database.client.begin(async (sql: DatabaseTransaction) => {
      const challenges = await sql<{ id: string; address: string }[]>`
        SELECT id,address
        FROM wallet_registration_challenges
        WHERE id=${challengeId} AND user_id=${userId} AND family='evm'
          AND consumed_at IS NULL AND expires_at > now()
        FOR UPDATE
      `;
      const challenge = challenges[0];
      if (!challenge || challenge.address.toLowerCase() !== address.toLowerCase()) {
        return { status: 'invalid_challenge' };
      }

      const existingWallet = await sql<{ id: string }[]>`
        SELECT id FROM wallets WHERE user_id=${userId} AND family='evm' FOR UPDATE
      `;
      if (existingWallet[0]) return { status: 'wallet_exists' };

      const existingAddress = await sql<{ id: string }[]>`
        SELECT id FROM wallets WHERE family='evm' AND lower(address)=lower(${address}) FOR UPDATE
      `;
      if (existingAddress[0]) return { status: 'address_exists' };

      const consumed = await sql<{ id: string }[]>`
        UPDATE wallet_registration_challenges
        SET consumed_at=now()
        WHERE id=${challengeId} AND consumed_at IS NULL
        RETURNING id
      `;
      if (!consumed[0]) return { status: 'invalid_challenge' };

      const rows = await sql<StoredWallet[]>`
        INSERT INTO wallets(user_id,family,address,derivation_path)
        VALUES (${userId},'evm',${address},${derivationPath})
        RETURNING id,user_id AS "userId",family,address,
                  derivation_path AS "derivationPath",
                  created_at AS "createdAt",updated_at AS "updatedAt"
      `;
      return { status: 'registered', wallet: rows[0]! };
    });
  }
}
