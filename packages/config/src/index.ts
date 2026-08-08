import { z } from 'zod';

const environmentSchema = z.object({
  DATABASE_URL: z.url().startsWith('postgresql://'),
  REDIS_URL: z.url().startsWith('redis://'),
  WEB_URL: z.url(), API_URL: z.url(), ADMIN_URL: z.url(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});
export type G64Config = z.infer<typeof environmentSchema>;
export function loadConfig(environment: NodeJS.ProcessEnv = process.env): G64Config {
  return environmentSchema.parse(environment);
}
