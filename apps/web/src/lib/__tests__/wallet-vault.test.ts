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

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

afterEach(async () => {
  await deleteWalletVault();
});

describe('G64 encrypted wallet vault', () => {
  it('persists only encrypted entropy and decrypts it with the stored non-extractable key', async () => {
    const entropy = new Uint8Array(32);
    entropy[0] = 64;
    entropy[31] = 64;
    const wallet = walletFromEntropy(entropy);

    const saved = await createWalletVault(entropy, wallet.address);
    expect(saved.address).toBe(wallet.address);
    expect(saved.derivationPath).toBe("m/44'/60'/0'/0/0");
    expect(await hasWalletVault()).toBe(true);

    const restored = await decryptWalletEntropy();
    expect([...restored]).toEqual([...entropy]);

    const metadata = await getWalletVaultMetadata();
    expect(metadata?.address).toBe(wallet.address);
  });

  it('does not silently overwrite an existing wallet vault', async () => {
    const first = walletFromEntropy(new Uint8Array(32));
    const secondEntropy = new Uint8Array(32);
    secondEntropy[0] = 1;
    const second = walletFromEntropy(secondEntropy);

    await createWalletVault(first.entropy, first.address);
    await expect(createWalletVault(second.entropy, second.address)).rejects.toThrow(
      /already exists/,
    );

    const restored = await decryptWalletEntropy();
    expect([...restored]).toEqual([...first.entropy]);
  });

  it('uses a fresh IV when explicitly replacing a vault', async () => {
    const entropy = new Uint8Array(32);
    entropy[4] = 7;
    const wallet = walletFromEntropy(entropy);

    const first = await createWalletVault(entropy, wallet.address);
    await createWalletVault(entropy, wallet.address, { replace: true });
    const second = await getWalletVaultMetadata();

    expect(second?.address).toBe(first.address);
    expect(await decryptWalletEntropy()).toEqual(entropy);
  });
});
