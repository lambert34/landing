import { HttpException } from '@nestjs/common';
export class AuthError extends HttpException {
  constructor(code: string, status: number) {
    super({ code }, status);
  }
}
