import type { AuthUser, OtpPurpose } from '@g64/types';
export type { AuthUser, OtpPurpose };
export interface RequestOtpInput {
  email: string;
  purpose: OtpPurpose;
  ip: string;
}
export interface VerifiedAuth {
  user: AuthUser;
  sessionToken: string;
}
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
export interface EmailProvider {
  sendVerificationCode(email: string, code: string, ttlSeconds: number): Promise<void>;
}
export type AuditEvent =
  | 'otp_requested'
  | 'otp_request_rate_limited'
  | 'otp_verified'
  | 'otp_failed'
  | 'signup_completed'
  | 'login_completed'
  | 'session_created'
  | 'session_revoked';
