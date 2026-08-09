import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadConfig } from '@g64/config';
import { AppModule } from './app.module.js';
export async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.WEB_URL, credentials: true });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000));
}
void bootstrap();
