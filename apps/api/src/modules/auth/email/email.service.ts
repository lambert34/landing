import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_PROVIDER, type EmailProvider } from '../auth.types.js';
@Injectable()
export class EmailService {
  constructor(@Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider) {}
  sendVerificationCode(email: string, code: string, ttl: number): Promise<void> {
    return this.provider.sendVerificationCode(email, code, ttl);
  }
}
