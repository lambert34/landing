import type { OtpPurpose } from './auth.types.js';
export type ParseResult<T> = { success: true; data: T } | { success: false };
export function parseOtpRequest(
  body: unknown,
): ParseResult<{ email: string; purpose: OtpPurpose }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { success: false };
  const value = body as Record<string, unknown>;
  if (
    Object.keys(value).some((key) => !['email', 'purpose'].includes(key)) ||
    typeof value.email !== 'string' ||
    value.email.length > 322 ||
    (value.purpose !== 'signup' && value.purpose !== 'login')
  )
    return { success: false };
  return { success: true, data: { email: value.email, purpose: value.purpose } };
}
export function parseOtpVerify(body: unknown): ParseResult<{ challengeId: string; code: string }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { success: false };
  const value = body as Record<string, unknown>;
  if (
    Object.keys(value).some((key) => !['challengeId', 'code'].includes(key)) ||
    typeof value.challengeId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.challengeId,
    ) ||
    typeof value.code !== 'string' ||
    !/^\d{6}$/.test(value.code)
  )
    return { success: false };
  return { success: true, data: { challengeId: value.challengeId, code: value.code } };
}
