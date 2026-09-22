import type { Address, Hex } from 'viem';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production' ? 'https://api.crypto-g64.ru' : 'http://localhost:4000');

export interface EvmWallet {
  id: string;
  family: 'evm';
  address: Address;
  derivationPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvmWalletResponse {
  registered: boolean;
  wallet: EvmWallet | null;
}

export interface WalletRegistrationChallengeResponse {
  challengeId: string;
  message: string;
  expiresAt: string;
}

export class WalletApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'WalletApiError';
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as
    | ({ code?: string } & Record<string, unknown>)
    | null;

  if (!response.ok) {
    throw new WalletApiError(body?.code ?? 'WALLET_REQUEST_FAILED', response.status);
  }

  return body as T;
}

export function getEvmWallet(): Promise<EvmWalletResponse> {
  return apiRequest<EvmWalletResponse>('/wallets/evm');
}

export function requestWalletRegistrationChallenge(
  address: Address,
): Promise<WalletRegistrationChallengeResponse> {
  return apiRequest<WalletRegistrationChallengeResponse>('/wallets/evm/registration-challenge', {
    method: 'POST',
    body: JSON.stringify({ address }),
  });
}

export function registerEvmWallet(
  challengeId: string,
  signature: Hex,
): Promise<{ wallet: EvmWallet }> {
  return apiRequest<{ wallet: EvmWallet }>('/wallets/evm/register', {
    method: 'POST',
    body: JSON.stringify({ challengeId, signature }),
  });
}

export function walletApiErrorMessage(error: unknown): string {
  if (!(error instanceof WalletApiError)) {
    return 'Wallet setup failed. Please try again.';
  }

  switch (error.code) {
    case 'WALLET_ALREADY_REGISTERED':
      return 'This G64 account already has an EVM wallet.';
    case 'WALLET_ADDRESS_ALREADY_REGISTERED':
      return 'This wallet address is already registered to another G64 account.';
    case 'INVALID_OR_EXPIRED_WALLET_CHALLENGE':
      return 'The wallet confirmation expired. Please try again.';
    case 'INVALID_WALLET_SIGNATURE':
      return 'The wallet signature could not be verified.';
    case 'INVALID_REQUEST':
      return 'The wallet request was invalid.';
    default:
      return 'Wallet setup failed. Please try again.';
  }
}
