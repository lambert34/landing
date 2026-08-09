import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { loadConfig } from '@g64/config';
import { AuthService } from './auth.service.js';
import { cookieValue, type HttpRequest } from './http.types.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const session = await this.auth.session(cookieValue(request, loadConfig().SESSION_COOKIE_NAME));
    if (!session.authenticated || !session.user) throw new UnauthorizedException();
    request.authUser = session.user;
    return true;
  }
}
