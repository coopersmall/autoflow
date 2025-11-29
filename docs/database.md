# Database Guide

Autoflow uses [Drizzle ORM](https://orm.drizzle.team/) with PostgreSQL for database operations.

## Quick Reference

```bash
make db-generate   # Generate migrations from schema
make db-migrate    # Apply migrations
make db-push       # Push schema directly (dev only)
```

## Schema Definition

Schemas are defined in `packages/backend/drizzle/schema.ts`:

```typescript
import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at'),
  data: jsonb('data').notNull(),
});
```

## Database Operations

Operations go through repositories (see [Services Guide](./services.md)):

```typescript
// Repos use adapters for database access
const repo = createUsersRepo({ appConfig });

const result = await repo.get(userId);
```

## Migrations

### Creating Migrations

```bash
# 1. Update schema in drizzle/schema.ts
# 2. Generate migration
make db-generate

# 3. Review generated SQL in drizzle/0001_*.sql
# 4. Apply migration
make db-migrate
```

### Development Workflow

```bash
# Quick iteration (no migrations)
make db-push

# Production workflow (with migrations)
make db-generate
make db-migrate
```

## Next Steps

- [Services Guide](./services.md) - Use database via services
- [Testing Guide](./testing.md) - Integration tests with database
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
