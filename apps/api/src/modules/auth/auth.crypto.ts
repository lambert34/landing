import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
export const generateOtp = (): string => randomInt(0, 1_000_000).toString().padStart(6, '0');
export const otpDigest = (pepper: string, challengeId: string, code: string): string =>
  createHmac('sha256', pepper).update(`${challengeId}:${code}`).digest('hex');
export const verifyDigest = (expected: string, actual: string): boolean => {
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(actual, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
};
export const generateSessionToken = (): string => randomBytes(32).toString('base64url');
export const sessionHash = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
export const subjectHash = (pepper: string, value: string): string =>
  createHmac('sha256', pepper).update(value).digest('hex');
export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('INVALID_REQUEST');
  return email;
}
