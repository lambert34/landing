import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';
import type { Address, Hex } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';

export const EVM_DERIVATION_PATH = "m/44'/60'/0'/0/0" as const;
export const EVM_CHAIN_ID = 11155111;
export const WALLET_ENTROPY_BYTES = 32;
export const WALLET_MNEMONIC_WORDS = 24;

export interface WalletMaterial {
  entropy: Uint8Array;
  mnemonic: string;
  address: Address;
}

export function normalizeMnemonic(value: string): string {
  return value
    .normalize('NFKD')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .join(' ');
}

export function walletFromEntropy(entropy: Uint8Array): WalletMaterial {
  if (entropy.length !== WALLET_ENTROPY_BYTES) {
    throw new Error('G64 wallet entropy must be exactly 256 bits.');
  }

  const entropyCopy = new Uint8Array(entropy);
  const mnemonic = entropyToMnemonic(entropyCopy, english);
  const address = deriveEvmAddress(mnemonic);

  return { entropy: entropyCopy, mnemonic, address };
}

export function generateWalletMaterial(): WalletMaterial {
  const entropy = crypto.getRandomValues(new Uint8Array(WALLET_ENTROPY_BYTES));
  return walletFromEntropy(entropy);
}

export function restoreWalletMaterial(value: string): WalletMaterial {
  const mnemonic = normalizeMnemonic(value);
  const words = mnemonic.split(' ');

  if (words.length !== WALLET_MNEMONIC_WORDS || !validateMnemonic(mnemonic, english)) {
    throw new Error('Enter a valid 24-word BIP-39 recovery phrase.');
  }

  const entropy = mnemonicToEntropy(mnemonic, english);
  if (entropy.length !== WALLET_ENTROPY_BYTES) {
    throw new Error('G64 requires a 24-word BIP-39 recovery phrase.');
  }

  return walletFromEntropy(entropy);
}

export function deriveEvmAddress(value: string): Address {
  const mnemonic = normalizeMnemonic(value);
  if (!validateMnemonic(mnemonic, english)) {
    throw new Error('Invalid BIP-39 recovery phrase.');
  }

  return mnemonicToAccount(mnemonic, { path: EVM_DERIVATION_PATH }).address;
}

export async function signEvmMessage(value: string, message: string): Promise<Hex> {
  const mnemonic = normalizeMnemonic(value);
  if (!validateMnemonic(mnemonic, english)) {
    throw new Error('Invalid BIP-39 recovery phrase.');
  }

  const account = mnemonicToAccount(mnemonic, { path: EVM_DERIVATION_PATH });
  return account.signMessage({ message });
}

export function wipeBytes(bytes: Uint8Array): void {
  bytes.fill(0);
}
