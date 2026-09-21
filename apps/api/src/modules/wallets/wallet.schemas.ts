import { getAddress, isAddress } from 'viem';

export interface WalletChallengeInput {
  address: `0x${string}`;
}

export interface WalletRegisterInput {
  challengeId: string;
  signature: `0x${string}`;
}

export function parseWalletChallengeInput(body: unknown): WalletChallengeInput | null {
  if (!body || typeof body !== 'object') return null;
  const address = (body as Record<string, unknown>).address;
  if (typeof address !== 'string' || !isAddress(address)) return null;
  return { address: getAddress(address) };
}

export function parseWalletRegisterInput(body: unknown): WalletRegisterInput | null {
  if (!body || typeof body !== 'object') return null;
  const value = body as Record<string, unknown>;
  if (
    typeof value.challengeId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.challengeId,
    ) ||
    typeof value.signature !== 'string' ||
    !/^0x[0-9a-f]{130}$/i.test(value.signature)
  ) {
    return null;
  }

  return {
    challengeId: value.challengeId,
    signature: value.signature as `0x${string}`,
  };
}
