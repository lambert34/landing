import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { walletFromEntropy } from '../wallet-crypto';
import {
  createWalletVault,
  decryptWalletEntropy,
  deleteWalletVault,
  getWalletVaultMetadata,
  hasWalletVault,
} from '../wallet-vault';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

afterEach(async () => {
  await deleteWalletVault(USER_A);
  await deleteWalletVault(USER_B);
});

describe('G64 encrypted wallet vault', () => {
  it('persists only encrypted entropy and decrypts it with the stored non-extractable key', async () => {
    const entropy = new Uint8Array(32);
    entropy[0] = 64;
    entropy[31] = 64;
    const wallet = walletFromEntropy(entropy);

    const saved = await createWalletVault(USER_A, entropy, wallet.address);
    expect(saved.userId).toBe(USER_A);
    expect(saved.address).toBe(wallet.address);
    expect(saved.derivationPath).toBe("m/44'/60'/0'/0/0");
    expect(await hasWalletVault(USER_A)).toBe(true);

    const restored = await decryptWalletEntropy(USER_A);
    expect([...restored]).toEqual([...entropy]);

    const metadata = await getWalletVaultMetadata(USER_A);
    expect(metadata?.userId).toBe(USER_A);
    expect(metadata?.address).toBe(wallet.address);
  });

  it('isolates local vaults between G64 accounts in the same browser', async () => {
    const entropyA = new Uint8Array(32);
    entropyA[0] = 1;
    const entropyB = new Uint8Array(32);
    entropyB[0] = 2;

    const walletA = walletFromEntropy(entropyA);
    const walletB = walletFromEntropy(entropyB);

    await createWalletVault(USER_A, entropyA, walletA.address);
    await createWalletVault(USER_B, entropyB, walletB.address);

    expect((await getWalletVaultMetadata(USER_A))?.address).toBe(walletA.address);
    expect((await getWalletVaultMetadata(USER_B))?.address).toBe(walletB.address);
    expect([...await decryptWalletEntropy(USER_A)]).toEqual([...entropyA]);
    expect([...await decryptWalletEntropy(USER_B)]).toEqual([...entropyB]);
  });

  it('does not silently overwrite an existing wallet vault for the same account', async () => {
    const first = walletFromEntropy(new Uint8Array(32));
    const secondEntropy = new Uint8Array(32);
    secondEntropy[0] = 1;
    const second = walletFromEntropy(secondEntropy);

    await createWalletVault(USER_A, first.entropy, first.address);
    await expect(createWalletVault(USER_A, second.entropy, second.address)).rejects.toThrow(
      /already exists/,
    );

    const restored = await decryptWalletEntropy(USER_A);
    expect([...restored]).toEqual([...first.entropy]);
  });

  it('can explicitly replace a vault during verified recovery', async () => {
    const entropy = new Uint8Array(32);
    entropy[4] = 7;
    const wallet = walletFromEntropy(entropy);

    const first = await createWalletVault(USER_A, entropy, wallet.address);
    await createWalletVault(USER_A, entropy, wallet.address, { replace: true });
    const second = await getWalletVaultMetadata(USER_A);

    expect(second?.address).toBe(first.address);
    expect(second?.createdAt).toBe(first.createdAt);
    expect(await decryptWalletEntropy(USER_A)).toEqual(entropy);
  });
});
