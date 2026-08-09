import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { EMAIL_PROVIDER } from './auth.types.js';
import { EmailService } from './email/email.service.js';
import { SmtpEmailProvider } from './email/smtp-email.provider.js';
import { OriginGuard } from './origin.guard.js';
import { SessionGuard } from './session.guard.js';
@Module({
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    EmailService,
    SmtpEmailProvider,
    { provide: EMAIL_PROVIDER, useExisting: SmtpEmailProvider },
    OriginGuard,
    SessionGuard,
  ],
  exports: [AuthService, SessionGuard, OriginGuard],
})
export class AuthModule {}
