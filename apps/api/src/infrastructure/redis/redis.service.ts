import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { loadConfig } from '@g64/config';
import { createClient } from 'redis';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private client?: ReturnType<typeof createClient>;
  private connecting?: Promise<ReturnType<typeof createClient>>;

  private async getClient(): Promise<ReturnType<typeof createClient>> {
    if (this.client?.isReady) return this.client;
    if (this.connecting) return this.connecting;

    const client = createClient({ url: loadConfig().REDIS_URL });
    client.on('error', () => {
      // Intentionally avoid logging connection details or credentials here.
    });

    this.connecting = client
      .connect()
      .then(() => {
        this.client = client;
        return client;
      })
      .finally(() => {
        this.connecting = undefined;
      });

    return this.connecting;
  }

  async incrementWithin(key: string, limit: number, seconds: number): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.eval(
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
      { keys: [key], arguments: [String(seconds)] },
    );
    return Number(result) <= limit;
  }

  async ping(): Promise<void> {
    const client = await this.getClient();
    await client.ping();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client?.isOpen) await this.client.quit();
  }
}
