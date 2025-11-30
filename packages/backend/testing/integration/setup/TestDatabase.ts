import path from 'node:path';
import * as schema from '@backend/infrastructure/db/schema';
import { getTableName } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Shared connection - tests run sequentially so we can share
let sharedSql: postgres.Sql | null = null;
let sharedDb: ReturnType<typeof drizzle> | null = null;
let refCount = 0;
let initialized = false;

export class TestDatabase {
  private sql!: postgres.Sql;
  private db!: ReturnType<typeof drizzle>;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async initialize(): Promise<void> {
    if (!sharedSql) {
      sharedSql = postgres(this.connectionString, { max: 10 });
      sharedDb = drizzle(sharedSql, { schema });
    }

    this.sql = sharedSql;
    this.db = sharedDb!;
    refCount++;

    if (!initialized) {
      await migrate(this.db, {
        migrationsFolder: path.resolve(import.meta.dir, '../../../drizzle'),
      });
      initialized = true;
    }
  }

  async truncateAll(): Promise<void> {
    const tables = Object.values(schema).map((table) => getTableName(table));
    await this.sql.unsafe(
      `TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
    );
  }

  getConnectionString(): string {
    return this.connectionString;
  }

  async close(): Promise<void> {
    refCount--;
    if (refCount <= 0 && sharedSql) {
      await sharedSql.end();
      sharedSql = null;
      sharedDb = null;
      initialized = false;
      refCount = 0;
    }
  }
}
