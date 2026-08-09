import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { createConnection, type Socket } from 'node:net';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import { loadConfig } from '@g64/config';

type RedisSocket = Socket | TLSSocket;
@Injectable()
export class RedisService implements OnApplicationShutdown {
  private socket?: RedisSocket;
  private buffer = Buffer.alloc(0);
  private queue: Array<{ resolve: (v: string) => void; reject: (e: Error) => void }> = [];
  private async connect(): Promise<RedisSocket> {
    if (this.socket && !this.socket.destroyed) return this.socket;
    const url = new URL(loadConfig().REDIS_URL);
    const port = Number(url.port || (url.protocol === 'rediss:' ? 6380 : 6379));
    const socket =
      url.protocol === 'rediss:'
        ? tlsConnect({ host: url.hostname, port, servername: url.hostname })
        : createConnection({ host: url.hostname, port });
    socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.drain();
    });
    socket.on('error', () => {
      const error = new Error('Redis connection failed');
      for (const item of this.queue.splice(0)) item.reject(error);
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    this.socket = socket;
    if (url.password)
      await this.command(
        'AUTH',
        ...(url.username ? [decodeURIComponent(url.username)] : []),
        decodeURIComponent(url.password),
      );
    return socket;
  }
  private drain(): void {
    const end = this.buffer.indexOf('\r\n');
    if (end < 0 || this.queue.length === 0) return;
    const line = this.buffer.subarray(0, end).toString();
    this.buffer = this.buffer.subarray(end + 2);
    const item = this.queue.shift();
    if (!item) return;
    if (line.startsWith('-')) item.reject(new Error('Redis command failed'));
    else item.resolve(line.slice(1));
    this.drain();
  }
  async command(...args: string[]): Promise<string> {
    const socket = await this.connect();
    const body = `*${args.length}\r\n${args.map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`).join('')}`;
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
      socket.write(body);
    });
  }
  async incrementWithin(key: string, limit: number, seconds: number): Promise<boolean> {
    const result = await this.command(
      'EVAL',
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
      '1',
      key,
      String(seconds),
    );
    return Number(result) <= limit;
  }
  async ping(): Promise<void> {
    await this.command('PING');
  }
  onApplicationShutdown(): void {
    this.socket?.destroy();
  }
}
