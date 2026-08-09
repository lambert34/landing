import { Injectable } from '@nestjs/common';
import { createConnection } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import { loadConfig } from '@g64/config';
import type { EmailProvider } from '../auth.types.js';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  async sendVerificationCode(email: string, code: string, ttlSeconds: number): Promise<void> {
    const c = loadConfig();
    const socket = c.SMTP_SECURE
      ? tlsConnect({ host: c.SMTP_HOST, port: c.SMTP_PORT, servername: c.SMTP_HOST })
      : createConnection({ host: c.SMTP_HOST, port: c.SMTP_PORT });
    let pending = '';
    const wait = (): Promise<string> =>
      new Promise((resolve, reject) => {
        const onData = (data: Buffer) => {
          pending += data.toString();
          if (/\r\n$/.test(pending) && !/^\d{3}-/m.test(pending.split('\r\n').at(-2) ?? '')) {
            cleanup();
            resolve(pending);
            pending = '';
          }
        };
        const onError = () => {
          cleanup();
          reject(new Error('SMTP delivery failed'));
        };
        const cleanup = () => {
          socket.off('data', onData);
          socket.off('error', onError);
        };
        socket.on('data', onData);
        socket.once('error', onError);
      });
    const command = async (line: string): Promise<void> => {
      socket.write(`${line}\r\n`);
      const response = await wait();
      if (!/^[23]/.test(response)) throw new Error('SMTP delivery failed');
    };
    await wait();
    await command('EHLO g64-api');
    if (c.SMTP_USER) {
      await command('AUTH LOGIN');
      await command(Buffer.from(c.SMTP_USER).toString('base64'));
      await command(Buffer.from(c.SMTP_PASSWORD).toString('base64'));
    }
    const from = c.EMAIL_FROM.match(/<([^>]+)>/)?.[1] ?? c.EMAIL_FROM;
    await command(`MAIL FROM:<${from}>`);
    await command(`RCPT TO:<${email}>`);
    await command('DATA');
    const minutes = Math.ceil(ttlSeconds / 60);
    const body = [
      `From: ${c.EMAIL_FROM}`,
      `To: ${email}`,
      'Subject: Your G64 verification code',
      'Content-Type: text/plain; charset=utf-8',
      '',
      `Your G64 verification code is ${code}.`,
      `It expires in ${minutes} minutes.`,
      'If you did not request this code, you can ignore this email.',
      '.',
    ].join('\r\n');
    await command(body);
    socket.end('QUIT\r\n');
  }
}
