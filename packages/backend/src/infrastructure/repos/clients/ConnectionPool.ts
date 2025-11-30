import type {
  DatabaseClientType,
  IDatabaseClient,
} from '@backend/infrastructure/repos/domain/DatabaseClient';
import { SQL } from 'bun';

// Module-level state (replaces static class property)
const pools = new Map<string, IDatabaseClient>();

function createClient(url: string, type: DatabaseClientType): IDatabaseClient {
  switch (type) {
    case 'bun-sql':
      return new SQL(url, {
        max: 100,
        connectionTimeout: 10000,
      });
  }
}

export function getClient(
  url: string,
  type: DatabaseClientType,
): IDatabaseClient {
  const key = `${type}:${url}`;

  const existingClient = pools.get(key);
  if (existingClient) {
    return existingClient;
  }

  const client = createClient(url, type);
  pools.set(key, client);
  return client;
}

export async function closeAll(): Promise<void> {
  const closePromises = Array.from(pools.values()).map((client) =>
    client.close(),
  );
  await Promise.all(closePromises);
  pools.clear();
}

export function clear(): void {
  pools.clear();
}
