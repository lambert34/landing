import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { loadConfig } from '@g64/config';
import type { OtpRequestResponse, SessionResponse } from '@g64/types';
import { AuthError } from './auth.error.js';
import { parseOtpRequest, parseOtpVerify } from './auth.schemas.js';
import { AuthService } from './auth.service.js';
import {
  cookieValue,
  type CookieOptions,
  type HttpRequest,
  type HttpResponse,
} from './http.types.js';
import { OriginGuard } from './origin.guard.js';

@Controller('auth')
export class AuthController {
  private readonly config = loadConfig();
  constructor(private readonly auth: AuthService) {}
  @Post('otp/request') async requestOtp(
    @Body() body: unknown,
    @Req() request: HttpRequest,
  ): Promise<OtpRequestResponse> {
    const parsed = parseOtpRequest(body);
    if (!parsed.success) throw new AuthError('INVALID_REQUEST', 400);
    return this.auth.requestOtp({
      ...parsed.data,
      ip: request.ip ?? request.socket.remoteAddress ?? 'unknown',
    });
  }
  @Post('otp/verify') async verifyOtp(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<SessionResponse> {
    const parsed = parseOtpVerify(body);
    if (!parsed.success) throw new AuthError('INVALID_REQUEST', 400);
    const result = await this.auth.verifyOtp(parsed.data.challengeId, parsed.data.code);
    response.cookie(this.config.SESSION_COOKIE_NAME, result.sessionToken, {
      ...this.cookieOptions(),
      maxAge: this.config.SESSION_TTL_SECONDS * 1000,
    });
    return { authenticated: true, user: result.user };
  }
  @Get('session') session(@Req() request: HttpRequest): Promise<SessionResponse> {
    return this.auth.session(cookieValue(request, this.config.SESSION_COOKIE_NAME));
  }
  @Post('logout') @UseGuards(OriginGuard) async logout(
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) response: HttpResponse,
  ): Promise<{ success: true }> {
    await this.auth.logout(cookieValue(request, this.config.SESSION_COOKIE_NAME));
    response.clearCookie(this.config.SESSION_COOKIE_NAME, this.cookieOptions());
    return { success: true };
  }
  private cookieOptions(): CookieOptions {
    const options: CookieOptions = {
      httpOnly: true,
      secure: this.config.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    };
    if (this.config.AUTH_COOKIE_DOMAIN) options.domain = this.config.AUTH_COOKIE_DOMAIN;
    return options;
  }
}
