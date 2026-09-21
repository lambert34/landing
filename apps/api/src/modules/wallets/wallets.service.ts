import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import type {
  EvmWalletResponse,
  WalletRegistrationChallengeResponse,
  WalletRegistrationResponse,
} from '@g64/types';
import { getAddress, recoverMessageAddress } from 'viem';
import { WalletError } from './wallet.error.js';
import { WalletsRepository, type StoredWallet } from './wallets.repository.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const EVM_DERIVATION_PATH = "m/44'/60'/0'/0/0";

@Injectable()
export class WalletsService {
  constructor(private readonly repository: WalletsRepository) {}

  async evmWallet(userId: string): Promise<EvmWalletResponse> {
    const wallet = await this.repository.walletForUser(userId);
    return {
      registered: wallet !== null,
      wallet: wallet ? this.present(wallet) : null,
    };
  }

  async createRegistrationChallenge(
    userId: string,
    address: `0x${string}`,
  ): Promise<WalletRegistrationChallengeResponse> {
    if (await this.repository.walletForUser(userId)) {
      throw new WalletError('WALLET_ALREADY_REGISTERED', 409);
    }

    const normalizedAddress = getAddress(address);
    const challengeId = randomUUID();
    const nonce = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    const message = [
      'G64 Wallet Registration',
      '',
      `Account: ${userId}`,
      `Address: ${normalizedAddress}`,
      `Challenge: ${challengeId}`,
      `Nonce: ${nonce}`,
      `Expires: ${expiresAt.toISOString()}`,
      '',
      'Sign this message only to register this wallet with G64.',
    ].join('\n');

    await this.repository.createChallenge({
      id: challengeId,
      userId,
      address: normalizedAddress,
      message,
      expiresAt,
    });

    return {
      challengeId,
      message,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async register(
    userId: string,
    challengeId: string,
    signature: `0x${string}`,
  ): Promise<WalletRegistrationResponse> {
    const challenge = await this.repository.challenge(challengeId, userId);
    if (!challenge) throw new WalletError('INVALID_OR_EXPIRED_WALLET_CHALLENGE', 400);

    let recovered: string;
    try {
      recovered = await recoverMessageAddress({
        message: challenge.message,
        signature,
      });
    } catch {
      throw new WalletError('INVALID_WALLET_SIGNATURE', 400);
    }

    const expectedAddress = getAddress(challenge.address);
    if (getAddress(recovered) !== expectedAddress) {
      throw new WalletError('INVALID_WALLET_SIGNATURE', 400);
    }

    const result = await this.repository.consumeAndRegister(
      challengeId,
      userId,
      expectedAddress,
      EVM_DERIVATION_PATH,
    );

    if (result.status === 'invalid_challenge') {
      throw new WalletError('INVALID_OR_EXPIRED_WALLET_CHALLENGE', 400);
    }
    if (result.status === 'wallet_exists') {
      throw new WalletError('WALLET_ALREADY_REGISTERED', 409);
    }
    if (result.status === 'address_exists') {
      throw new WalletError('WALLET_ADDRESS_ALREADY_REGISTERED', 409);
    }

    return { wallet: this.present(result.wallet) };
  }

  private present(wallet: StoredWallet) {
    return {
      id: wallet.id,
      family: 'evm' as const,
      address: getAddress(wallet.address),
      derivationPath: wallet.derivationPath,
      createdAt: this.toIsoString(wallet.createdAt),
      updatedAt: this.toIsoString(wallet.updatedAt),
    };
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
