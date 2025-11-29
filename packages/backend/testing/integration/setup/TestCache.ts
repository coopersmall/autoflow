import { RedisClient } from 'bun';

export class TestCache {
  private client: RedisClient;

  constructor(connectionString: string) {
    this.client = new RedisClient(connectionString);
  }

  async initialize(): Promise<void> {
    await this.client.ping();
  }

  async flushAll(): Promise<void> {
    await this.client.send('FLUSHALL', []);
  }

  async close(): Promise<void> {
    this.client.close();
  }

  getClient(): RedisClient {
    return this.client;
  }
}
