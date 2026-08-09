import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@g64/types';
import type { HttpRequest } from './http.types.js';
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | null =>
    context.switchToHttp().getRequest<HttpRequest>().authUser as AuthUser | null,
);
