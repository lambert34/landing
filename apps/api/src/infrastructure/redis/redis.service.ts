import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { loadConfig } from '@g64/config';
import { createClient } from 'redis';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly client = createClient({ url: loadConfig().REDIS_URL });
  private connecting: Promise<void> | undefined;

  constructor() {
    this.client.on('error', () => {
      // Intentionally avoid logging connection details or credentials here.
    });
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.isReady) return;
    if (this.connecting) return this.connecting;

    this.connecting = this.client
      .connect()
      .then(() => undefined)
      .finally(() => {
        this.connecting = undefined;
      });

    return this.connecting;
  }

  async incrementWithin(key: string, limit: number, seconds: number): Promise<boolean> {
    await this.ensureConnected();
    const result = await this.client.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
      { keys: [key], arguments: [String(seconds)] },
    );
    return Number(result) <= limit;
  }

  async ping(): Promise<void> {
    await this.ensureConnected();
    await this.client.ping();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) await this.client.quit();
  }
}
