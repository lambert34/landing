import { defineConfig } from 'drizzle-kit';
export default defineConfig({ schema: './src/schema.ts', out: './drizzle', dialect: 'postgresql', dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://g64:g64_dev@localhost:5432/g64' } });
