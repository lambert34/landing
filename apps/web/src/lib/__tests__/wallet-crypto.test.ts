import { describe, expect, it } from 'vitest';
import {
  EVM_DERIVATION_PATH,
  restoreWalletMaterial,
  walletFromEntropy,
  wipeBytes,
} from '../wallet-crypto';

const ZERO_ENTROPY_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';

describe('G64 wallet cryptography', () => {
  it('turns 256-bit entropy into a valid 24-word mnemonic', () => {
    const material = walletFromEntropy(new Uint8Array(32));
    expect(material.mnemonic).toBe(ZERO_ENTROPY_MNEMONIC);
    expect(material.mnemonic.split(' ')).toHaveLength(24);
    expect(material.entropy).toHaveLength(32);
  });

  it('uses the fixed Ethereum derivation path and deterministic address', () => {
    expect(EVM_DERIVATION_PATH).toBe("m/44'/60'/0'/0/0");
    const first = restoreWalletMaterial(ZERO_ENTROPY_MNEMONIC);
    const second = restoreWalletMaterial(ZERO_ENTROPY_MNEMONIC);
    expect(first.address).toBe(second.address);
    expect(first.address).toMatch(/^0x[0-9A-Fa-f]{40}$/);
  });

  it('rejects an invalid mnemonic checksum', () => {
    const invalid = ZERO_ENTROPY_MNEMONIC.replace(/ art$/, 'abandon');
    expect(() => restoreWalletMaterial(invalid)).toThrow(/valid 24-word BIP-39/);
  });

  it('best-effort wipes secret byte arrays in memory', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    wipeBytes(bytes);
    expect([...bytes]).toEqual([0, 0, 0, 0]);
  });
});
