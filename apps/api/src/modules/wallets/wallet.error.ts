import { HttpException } from '@nestjs/common';

export class WalletError extends HttpException {
  constructor(code: string, status: number) {
    super({ code }, status);
  }
}
