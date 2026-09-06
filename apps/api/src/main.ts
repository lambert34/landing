import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { loadConfig } from '@g64/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppModule } from './app.module.js';
import { createCorsOptions } from './cors.js';

type HttpHandler = (request: IncomingMessage, response: ServerResponse) => void;

function configureApp(app: INestApplication): void {
  const config = loadConfig();
  app.setGlobalPrefix('api');
  app.enableCors(createCorsOptions(config.WEB_URL));
}

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000));
}

let serverlessHandler: Promise<HttpHandler> | undefined;

async function getServerlessHandler(): Promise<HttpHandler> {
  if (!serverlessHandler) {
    serverlessHandler = (async () => {
      const adapter = new ExpressAdapter();
      const app = await NestFactory.create(AppModule, adapter);
      configureApp(app);
      await app.init();
      return adapter.getInstance() as HttpHandler;
    })();
  }

  return serverlessHandler;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const server = await getServerlessHandler();
  server(request, response);
}

if (!process.env.VERCEL) {
  void bootstrap();
}
