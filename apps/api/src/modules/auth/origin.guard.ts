import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { loadConfig } from '@g64/config';
import type { HttpRequest } from './http.types.js';
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly origin = loadConfig().WEB_URL;
  canActivate(context: ExecutionContext): boolean {
    return context.switchToHttp().getRequest<HttpRequest>().headers.origin === this.origin;
  }
}
