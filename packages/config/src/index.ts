import { z } from 'zod';

const optionalLocal = z.string().default('');
const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    WEB_URL: z.url(),
    API_URL: z.url(),
    ADMIN_URL: z.url().default('http://localhost:3001'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    OTP_PEPPER: z.string().min(32),
    RATE_LIMIT_PEPPER: z.string().min(32),
    OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
    OTP_RESEND_SECONDS: z.coerce.number().int().positive().default(60),
    OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    SESSION_COOKIE_NAME: z.string().min(1).default('g64_session'),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
    AUTH_COOKIE_DOMAIN: optionalLocal,
    SMTP_HOST: optionalLocal,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    SMTP_USER: optionalLocal,
    SMTP_PASSWORD: optionalLocal,
    EMAIL_FROM: optionalLocal,
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== 'production') return;
    for (const key of [
      'SMTP_HOST',
      'SMTP_USER',
      'SMTP_PASSWORD',
      'EMAIL_FROM',
      'AUTH_COOKIE_DOMAIN',
    ] as const) {
      if (!value[key])
        context.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required in production`,
        });
    }
    if (!value.AUTH_COOKIE_DOMAIN.endsWith('.crypto-g64.ru'))
      context.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_DOMAIN'],
        message: 'must support .crypto-g64.ru',
      });
  });
export type G64Config = z.infer<typeof schema>;
export function loadConfig(environment: NodeJS.ProcessEnv = process.env): G64Config {
  return schema.parse(environment);
}
