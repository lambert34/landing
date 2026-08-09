import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '@g64/config';
import type { OtpRequestResponse, SessionResponse } from '@g64/types';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { AuthError } from './auth.error.js';
import {
  generateOtp,
  generateSessionToken,
  normalizeEmail,
  otpDigest,
  sessionHash,
  subjectHash,
} from './auth.crypto.js';
import { AuthRepository } from './auth.repository.js';
import type { RequestOtpInput, VerifiedAuth } from './auth.types.js';
import { EmailService } from './email/email.service.js';

@Injectable()
export class AuthService {
  private readonly config = loadConfig();
  constructor(
    private readonly repository: AuthRepository,
    private readonly redis: RedisService,
    private readonly email: EmailService,
  ) {}
  async requestOtp(input: RequestOtpInput): Promise<OtpRequestResponse> {
    let email: string;
    try {
      email = normalizeEmail(input.email);
    } catch {
      throw new AuthError('INVALID_REQUEST', 400);
    }
    const emailKey = subjectHash(this.config.RATE_LIMIT_PEPPER, email);
    const ipKey = subjectHash(this.config.RATE_LIMIT_PEPPER, input.ip || 'unknown');
    const limits = await Promise.all([
      this.redis.incrementWithin(`auth:resend:${emailKey}`, 1, this.config.OTP_RESEND_SECONDS),
      this.redis.incrementWithin(`auth:email:${emailKey}`, 5, 900),
      this.redis.incrementWithin(`auth:ip:${ipKey}`, 20, 3600),
    ]);
    if (limits.includes(false)) {
      await this.repository.audit('otp_request_rate_limited', emailKey);
      throw new AuthError('RATE_LIMITED', 429);
    }
    const id = randomUUID();
    const code = generateOtp();
    const user = await this.repository.userByEmail(email);
    const deliver = input.purpose === 'signup' || user !== null;
    const digest = otpDigest(this.config.OTP_PEPPER, id, deliver ? code : generateOtp());
    await this.repository.createChallenge(
      id,
      email,
      input.purpose,
      digest,
      new Date(Date.now() + this.config.OTP_TTL_SECONDS * 1000),
    );
    if (deliver) await this.email.sendVerificationCode(email, code, this.config.OTP_TTL_SECONDS);
    await this.repository.audit('otp_requested', emailKey, user?.id);
    return {
      challengeId: id,
      expiresInSeconds: this.config.OTP_TTL_SECONDS,
      resendAfterSeconds: this.config.OTP_RESEND_SECONDS,
    };
  }
  async verifyOtp(challengeId: string, code: string): Promise<VerifiedAuth> {
    if (!/^\d{6}$/.test(code)) throw new AuthError('INVALID_REQUEST', 400);
    const digest = otpDigest(this.config.OTP_PEPPER, challengeId, code);
    const token = generateSessionToken();
    try {
      const result = await this.repository.consumeAndAuthenticate(
        challengeId,
        digest,
        this.config.OTP_MAX_ATTEMPTS,
        sessionHash(token),
        new Date(Date.now() + this.config.SESSION_TTL_SECONDS * 1000),
      );
      if (!result) {
        const failed = await this.repository.failChallenge(
          challengeId,
          this.config.OTP_MAX_ATTEMPTS,
        );
        await this.repository.audit('otp_failed', null);
        throw new AuthError(
          failed === 'limited' ? 'TOO_MANY_ATTEMPTS' : 'INVALID_OR_EXPIRED_CODE',
          failed === 'limited' ? 429 : 400,
        );
      }
      const auditHash = subjectHash(this.config.RATE_LIMIT_PEPPER, result.user.email);
      await this.repository.audit('otp_verified', auditHash, result.user.id);
      await this.repository.audit(
        result.purpose === 'signup' ? 'signup_completed' : 'login_completed',
        auditHash,
        result.user.id,
      );
      await this.repository.audit('session_created', null, result.user.id);
      return { sessionToken: token, user: this.present(result.user) };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      if (
        error instanceof Error &&
        (error.message === 'ACCOUNT_ALREADY_EXISTS' || error.message.includes('users_email_unique'))
      )
        throw new AuthError('ACCOUNT_ALREADY_EXISTS', 409);
      throw error;
    }
  }
  async session(rawToken?: string): Promise<SessionResponse> {
    if (!rawToken) return { authenticated: false, user: null };
    const found = await this.repository.session(sessionHash(rawToken));
    return found
      ? { authenticated: true, user: this.present(found.user) }
      : { authenticated: false, user: null };
  }
  async logout(rawToken?: string): Promise<void> {
    if (!rawToken) return;
    const userId = await this.repository.revoke(sessionHash(rawToken));
    if (userId) await this.repository.audit('session_revoked', null, userId);
  }
  private present(user: {
    id: string;
    email: string;
    createdAt: Date;
    emailVerifiedAt: Date | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    };
  }
}
