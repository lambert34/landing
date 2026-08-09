import { Injectable } from '@nestjs/common';
import { loadConfig } from '@g64/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailProvider } from '../auth.types.js';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private transporter?: Transporter;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const config = loadConfig();
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      requireTLS: config.NODE_ENV === 'production' && !config.SMTP_SECURE,
      auth: config.SMTP_USER
        ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
        : undefined,
    });
    return this.transporter;
  }

  async sendVerificationCode(email: string, code: string, ttlSeconds: number): Promise<void> {
    const config = loadConfig();
    const minutes = Math.ceil(ttlSeconds / 60);
    await this.getTransporter().sendMail({
      from: config.EMAIL_FROM,
      to: email,
      subject: 'Your G64 verification code',
      text: [
        `Your G64 verification code is ${code}.`,
        `It expires in ${minutes} minutes.`,
        'If you did not request this code, you can ignore this email.',
      ].join('\n'),
    });
  }
}
