import { describe, expect, it, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { EVM_DERIVATION_PATH, WalletsService } from '../wallets.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const CHALLENGE_ID = '22222222-2222-4222-8222-222222222222';
const PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const account = privateKeyToAccount(PRIVATE_KEY);

function challenge(message: string) {
  return {
    id: CHALLENGE_ID,
    userId: USER_ID,
    family: 'evm' as const,
    address: account.address,
    message,
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
  };
}

describe('WalletsService', () => {
  it('creates a challenge bound to the authenticated user and EVM address', async () => {
    const repository = {
      walletForUser: vi.fn().mockResolvedValue(null),
      createChallenge: vi.fn().mockResolvedValue(undefined),
    };
    const service = new WalletsService(repository as never);

    const result = await service.createRegistrationChallenge(USER_ID, account.address);
    expect(result.message).toContain(`Account: ${USER_ID}`);
    expect(result.message).toContain(`Address: ${account.address}`);
    expect(result.message).toContain(`Challenge: ${result.challengeId}`);
    expect(repository.createChallenge).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        address: account.address,
        message: result.message,
      }),
    );
  });

  it('registers the address only after a valid Ethereum message signature', async () => {
    const message = 'G64 Wallet Registration\nchallenge';
    const signature = await account.signMessage({ message });
    const storedWallet = {
      id: '33333333-3333-4333-8333-333333333333',
      userId: USER_ID,
      family: 'evm' as const,
      address: account.address,
      derivationPath: EVM_DERIVATION_PATH,
      createdAt: '2026-09-22T00:00:00.000Z',
      updatedAt: '2026-09-22T00:00:00.000Z',
    };
    const repository = {
      challenge: vi.fn().mockResolvedValue(challenge(message)),
      consumeAndRegister: vi
        .fn()
        .mockResolvedValue({ status: 'registered', wallet: storedWallet }),
    };
    const service = new WalletsService(repository as never);

    await expect(service.register(USER_ID, CHALLENGE_ID, signature)).resolves.toEqual({
      wallet: {
        id: storedWallet.id,
        family: 'evm',
        address: account.address,
        derivationPath: EVM_DERIVATION_PATH,
        createdAt: storedWallet.createdAt,
        updatedAt: storedWallet.updatedAt,
      },
    });
    expect(repository.consumeAndRegister).toHaveBeenCalledWith(
      CHALLENGE_ID,
      USER_ID,
      account.address,
      EVM_DERIVATION_PATH,
    );
  });

  it('rejects a signature from a different private key', async () => {
    const message = 'G64 Wallet Registration\nchallenge';
    const attacker = privateKeyToAccount(
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    );
    const signature = await attacker.signMessage({ message });
    const repository = {
      challenge: vi.fn().mockResolvedValue(challenge(message)),
      consumeAndRegister: vi.fn(),
    };
    const service = new WalletsService(repository as never);

    await expect(service.register(USER_ID, CHALLENGE_ID, signature)).rejects.toMatchObject({
      response: { code: 'INVALID_WALLET_SIGNATURE' },
      status: 400,
    });
    expect(repository.consumeAndRegister).not.toHaveBeenCalled();
  });

  it('rejects expired, consumed, or unknown challenges before signature verification', async () => {
    const repository = {
      challenge: vi.fn().mockResolvedValue(null),
      consumeAndRegister: vi.fn(),
    };
    const service = new WalletsService(repository as never);

    await expect(
      service.register(USER_ID, CHALLENGE_ID, `0x${'00'.repeat(65)}`),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_OR_EXPIRED_WALLET_CHALLENGE' },
      status: 400,
    });
    expect(repository.consumeAndRegister).not.toHaveBeenCalled();
  });

  it('surfaces replay protection when the repository cannot consume the challenge', async () => {
    const message = 'G64 Wallet Registration\nchallenge';
    const signature = await account.signMessage({ message });
    const repository = {
      challenge: vi.fn().mockResolvedValue(challenge(message)),
      consumeAndRegister: vi.fn().mockResolvedValue({ status: 'invalid_challenge' }),
    };
    const service = new WalletsService(repository as never);

    await expect(service.register(USER_ID, CHALLENGE_ID, signature)).rejects.toMatchObject({
      response: { code: 'INVALID_OR_EXPIRED_WALLET_CHALLENGE' },
      status: 400,
    });
  });
});
