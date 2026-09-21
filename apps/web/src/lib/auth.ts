export type AuthPurpose = 'signup' | 'login';

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
  emailVerifiedAt: string | null;
}

export interface SessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

export interface OtpRequestResponse {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

export interface PendingAuth {
  challengeId: string;
  email: string;
  purpose: AuthPurpose;
  expiresAt: number;
  resendAt: number;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === 'production' ? 'https://api.crypto-g64.ru' : 'http://localhost:4000');

const PENDING_AUTH_KEY = 'g64_pending_auth';

export class AuthApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'AuthApiError';
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
    throw new AuthApiError(body?.code ?? 'REQUEST_FAILED', response.status);
  }

  return body as T;
}

export function requestOtp(email: string, purpose: AuthPurpose): Promise<OtpRequestResponse> {
  return apiRequest<OtpRequestResponse>('/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ email, purpose }),
  });
}

export function verifyOtp(challengeId: string, code: string): Promise<SessionResponse> {
  return apiRequest<SessionResponse>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ challengeId, code }),
  });
}

export function getSession(): Promise<SessionResponse> {
  return apiRequest<SessionResponse>('/auth/session');
}

export function logout(): Promise<{ success: true }> {
  return apiRequest<{ success: true }>('/auth/logout', { method: 'POST' });
}

export function savePendingAuth(
  email: string,
  purpose: AuthPurpose,
  response: OtpRequestResponse,
): PendingAuth {
  const now = Date.now();
  const pending: PendingAuth = {
    challengeId: response.challengeId,
    email,
    purpose,
    expiresAt: now + response.expiresInSeconds * 1000,
    resendAt: now + response.resendAfterSeconds * 1000,
  };
  window.sessionStorage.setItem(PENDING_AUTH_KEY, JSON.stringify(pending));
  return pending;
}

export function loadPendingAuth(): PendingAuth | null {
  const raw = window.sessionStorage.getItem(PENDING_AUTH_KEY);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as Partial<PendingAuth>;
    if (
      typeof value.challengeId !== 'string' ||
      typeof value.email !== 'string' ||
      (value.purpose !== 'signup' && value.purpose !== 'login') ||
      typeof value.expiresAt !== 'number' ||
      typeof value.resendAt !== 'number'
    ) {
      clearPendingAuth();
      return null;
    }
    return value as PendingAuth;
  } catch {
    clearPendingAuth();
    return null;
  }
}

export function clearPendingAuth(): void {
  window.sessionStorage.removeItem(PENDING_AUTH_KEY);
}

export function authErrorMessage(error: unknown): string {
  if (!(error instanceof AuthApiError)) {
    return 'Something went wrong. Please try again.';
  }

  switch (error.code) {
    case 'RATE_LIMITED':
      return 'Too many requests. Please wait a moment and try again.';
    case 'INVALID_OR_EXPIRED_CODE':
      return 'That code is incorrect or has expired.';
    case 'TOO_MANY_ATTEMPTS':
      return 'Too many incorrect attempts. Request a new code.';
    case 'ACCOUNT_ALREADY_EXISTS':
      return 'An account already exists for this email. Sign in instead.';
    case 'INVALID_REQUEST':
      return 'Check the information you entered and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
