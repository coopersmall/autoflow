# Repository Layer Documentation

## Overview

The repository layer provides a **clean, type-safe abstraction** over database operations using a **layered architecture pattern**. It supports two distinct data access patterns optimized for different security and ownership models:

- **SharedRepo**: For globally accessible data without user ownership (e.g., users, system settings, public templates)
- **StandardRepo**: For user-scoped data with automatic isolation between users (e.g., documents, preferences, user-specific records)

Both repositories use the **adapter pattern** to abstract SQL query generation, ensuring security through parameterized queries and providing functional error handling with `Result` types.

---

## Architecture Overview

### Layered Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│  Domain Layer (Services, Business Logic)                │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│  Repository Layer                                        │
│  ├─ SharedRepo    (global data, no userId)             │
│  └─ StandardRepo  (user-scoped, requires userId)       │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│  Adapter Layer                                           │
│  └─ RelationalDatabaseAdapter                           │
│     (SQL generation + query execution)                  │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│  Client Layer (Factory + Implementations)               │
│  ├─ DatabaseClientFactory (connection management)      │
│  └─ BunDatabaseClient (Bun SQL implementation)         │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/lib/repos/
├── README.md                       # This file
├── SharedRepo.ts                   # Global data repository
├── StandardRepo.ts                 # User-scoped repository
├── actions/
│   └── convertQueryResultsToData.ts   # Raw DB → Domain conversion
├── adapters/
│   ├── RelationalDatabaseAdapter.ts   # SQL query generation
│   ├── __mocks__/
│   │   └── RelationalDatabaseAdapter.mock.ts
│   └── __tests__/
│       └── RelationalDatabaseAdapter.test.ts
├── clients/
│   ├── DatabaseClientFactory.ts    # Client factory with type parameter
│   ├── bun/
│   │   └── BunDatabaseClient.ts    # Bun SQL implementation
│   ├── __mocks__/
│   │   ├── DatabaseClient.mock.ts
│   │   └── DatabaseClientFactory.mock.ts
│   └── __tests__/
│       └── DatabaseClientFactory.test.ts
├── domain/
│   ├── DatabaseClient.ts           # Client interfaces & types
│   ├── DatabaseAdapter.ts          # Adapter interface
│   └── RawDatabaseQuery.ts         # Raw DB result schema
├── errors/
│   └── DBError.ts                  # Error factory functions
└── __tests__/
    ├── SharedRepo.test.ts
    └── StandardRepo.test.ts
```

---

## Core Components

### 1. Repository Layer (SharedRepo & StandardRepo)

**Responsibilities:**

- Provide domain-friendly CRUD operations
- Validate all data with Zod schemas
- Convert raw database results to domain entities
- Handle errors with `Result` types

**Key Differences:**

| Feature              | SharedRepo                   | StandardRepo                |
| -------------------- | ---------------------------- | --------------------------- |
| **User Scoping**     | None                         | Required on all operations  |
| **Method Signature** | `get(id)`                    | `get(id, userId)`           |
| **Use Cases**        | Users table, global settings | User documents, preferences |
| **Security Model**   | Service-layer authorization  | Database-level isolation    |

### 2. Adapter Layer (RelationalDatabaseAdapter)

**Responsibilities:**

- Generate parameterized SQL queries
- Execute queries via Bun SQL
- Validate raw results with `RawDatabaseQuery` schema
- Support both global and user-scoped operations

**SQL Generation Pattern:**

```typescript
// Progressive query composition
let query = db`SELECT * FROM ${table}`;
if (userId) query = db`${query} AND user_id = ${userId}`;
query = db`${query} LIMIT 1`;
const result = await query;
```

**Security Features:**

- All queries use parameterized values (no SQL injection)
- User ID filtering at SQL level when provided
- RETURNING clauses for atomic read-after-write

### 3. Client Layer (DatabaseClientFactory & Clients)

**Responsibilities:**

- Manage database client creation with type parameters
- Support multiple database types ('bun-sql', future: 'postgres', 'mysql')
- Validate configuration and handle connection errors
- Provide clean abstraction over database implementations

**Type-Safe Client Creation:**

```typescript
const factory = createDatabaseClientFactory(appConfig);
const client = factory.getDatabase('bun-sql', 'users');
// Returns: Result<IDatabaseClient, ErrorWithMetadata>
```

**Architecture Benefits:**

- **Extensibility**: Easy to add new database types
- **Type Safety**: Zod enum enforces valid client types
- **Error Handling**: Configuration errors caught early
- **Consistency**: Matches cache layer pattern exactly

### 4. Data Conversion Layer (convertQueryResultsToData)

**Responsibilities:**

- Parse ISO date strings → `Date` objects
- Spread `data` property fields into entity
- Validate with Zod schemas
- Fail fast on validation errors

**Data Flow:**

```
RawDatabaseQuery (snake_case, ISO strings)
           ↓
     Conversion Layer
           ↓
Domain Entity (camelCase, Date objects)
```

---

## Database Schema

### Shared Table Schema

```sql
CREATE TABLE shared_table (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

### Standard Table Schema

```sql
CREATE TABLE standard_table (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP
);
```

**Key Schema Conventions:**

- **snake_case** for database columns
- **JSONB data column** for flexible domain entity storage
- **ISO timestamp strings** (converted to `Date` by repository)
- **Optional `user_id`** for standard tables only

---

## Creating Repositories

### Creating a SharedRepo

For globally accessible data:

```typescript
import { SharedRepo } from '@/lib/repos/SharedRepo';
import type { IAppConfigurationService } from '@/lib/services/configuration/AppConfigurationService';
import type { MyEntity, MyEntityId } from '@/lib/domain/myEntity/myEntity';
import { validMyEntity } from '@/lib/domain/myEntity/validation/validMyEntity';

export class MySharedRepo extends SharedRepo<MyEntityId, MyEntity> {
  constructor(appConfig: IAppConfigurationService) {
    super(
      appConfig,
      'my_shared_table', // Database table name
      validMyEntity, // Zod validator function
    );
  }
}
```

### Creating a StandardRepo

For user-scoped data:

```typescript
import { StandardRepo } from '@/lib/repos/StandardRepo';
import type { IAppConfigurationService } from '@/lib/services/configuration/AppConfigurationService';
import type { MyEntity, MyEntityId } from '@/lib/domain/myEntity/myEntity';
import { validMyEntity } from '@/lib/domain/myEntity/validation/validMyEntity';

export class MyStandardRepo extends StandardRepo<MyEntityId, MyEntity> {
  constructor(appConfig: IAppConfigurationService) {
    super(
      appConfig,
      'my_standard_table', // Database table name
      validMyEntity, // Zod validator function
    );
  }
}
```

---

## Method Signatures

### SharedRepo Methods

```typescript
class SharedRepo<ID extends Id<string>, T extends Item<ID>> {
  // Retrieve single record by ID
  async get(id: ID): Promise<Result<T, DBError>>;

  // Retrieve all records with optional limit
  async all(opts?: { limit?: number }): Promise<Result<T[], ErrorWithMetadata>>;

  // Create new record
  async create(
    id: ID,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<T, DBError>>;

  // Update existing record (partial updates supported)
  async update(id: ID, data: Partial<T>): Promise<Result<T, DBError>>;

  // Delete record and return it
  async delete(id: ID): Promise<Result<T, DBError>>;

  // Direct database access for complex queries
  getDB(): Result<IDatabase, DBError>;
}
```

### StandardRepo Methods

```typescript
class StandardRepo<ID extends Id<string>, T extends Item<ID>> {
  // Retrieve single record by ID (user-scoped)
  async get(id: ID, userId: UserId): Promise<Result<T, DBError>>;

  // Retrieve all records for user with optional limit
  async all(
    userId: UserId,
    opts?: { limit?: number },
  ): Promise<Result<T[], ErrorWithMetadata>>;

  // Create new record for user
  async create(
    id: ID,
    userId: UserId,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<T, DBError>>;

  // Update existing record (only if owned by user)
  async update(
    id: ID,
    userId: UserId,
    data: Partial<T>,
  ): Promise<Result<T, DBError>>;

  // Delete record (only if owned by user)
  async delete(id: ID, userId: UserId): Promise<Result<T, DBError>>;

  // Direct database access for complex queries
  getDB(userId: UserId): Result<IDatabase, DBError>;
}
```

---

## Usage Examples

### Using SharedRepo (Global Data)

```typescript
import { MySharedRepo } from '@/lib/repos/MySharedRepo';
import { MyEntityId } from '@/lib/domain/myEntity/myEntity';

const repo = new MySharedRepo(appConfig);

// Get by ID
const result = await repo.get(MyEntityId('entity-123'));
if (result.isErr()) {
  console.error('Error:', result.error.message);
  return;
}
const entity = result.value;

// Get all (with optional limit)
const allResult = await repo.all({ limit: 100 });
if (allResult.isOk()) {
  console.log('Found:', allResult.value.length);
}

// Create
const createResult = await repo.create(MyEntityId('new-id'), {
  name: 'New Entity',
  value: 42,
  // ... other fields
});

// Update (partial)
const updateResult = await repo.update(MyEntityId('entity-123'), {
  value: 99, // Only update this field
});

// Delete
const deleteResult = await repo.delete(MyEntityId('entity-123'));
```

### Using StandardRepo (User-Scoped Data)

```typescript
import { MyStandardRepo } from '@/lib/repos/MyStandardRepo';
import { MyEntityId } from '@/lib/domain/myEntity/myEntity';
import { UserId } from '@/lib/domain/user/user';

const repo = new MyStandardRepo(appConfig);
const userId = UserId('user-456');

// Get by ID (only if owned by user)
const result = await repo.get(MyEntityId('doc-123'), userId);
if (result.isErr()) {
  // Could be NotFoundError or access denied
  console.error('Error:', result.error.message);
  return;
}
const document = result.value;

// Get all for user (with optional limit)
const allResult = await repo.all(userId, { limit: 50 });
if (allResult.isOk()) {
  console.log('User documents:', allResult.value.length);
}

// Create for user
const createResult = await repo.create(MyEntityId('new-doc'), userId, {
  title: 'My Document',
  content: '...',
});

// Update (only if owned by user)
const updateResult = await repo.update(MyEntityId('doc-123'), userId, {
  content: 'Updated content',
});

// Delete (only if owned by user)
const deleteResult = await repo.delete(MyEntityId('doc-123'), userId);
```

---

## Error Handling

All repository methods return `Result<T, DBError>` for functional error handling:

```typescript
import { NotFoundError } from '@/utils/errors/NotFoundError';
import { ValidationError } from '@/utils/errors/ValidationError';
import { ErrorWithMetadata } from '@/utils/errors/ErrorWithMetadata';

const result = await repo.get(id, userId);

if (result.isErr()) {
  const error = result.error;

  if (error instanceof NotFoundError) {
    // Record doesn't exist or user doesn't have access
    console.log('Not found:', error.message);
  } else if (error instanceof ValidationError) {
    // Data failed Zod schema validation
    console.log('Validation error:', error.message, error.issues);
  } else if (error instanceof ErrorWithMetadata) {
    // Database error or configuration error
    console.log('Database error:', error.message, error.metadata);
  }
} else {
  // Success case
  console.log('Data:', result.value);
}
```

**Error Types:**

- `NotFoundError` - Record doesn't exist or access denied
- `ValidationError` - Zod schema validation failed
- `ErrorWithMetadata` - Database connection, SQL execution, or configuration errors

---

## Security Model

### SharedRepo Security

**Database Level:**

- No automatic user filtering
- All records globally accessible

**Application Level:**

- Authorization must be implemented in service layer
- Consider caching for frequently accessed data
- Audit logging for sensitive operations

**Use Cases:**

- Users table (users accessing their own profile)
- System settings (admin-only access via service layer)
- Public templates (globally readable)

### StandardRepo Security

**Database Level:**

- **Automatic user isolation** - All queries include `WHERE user_id = ?`
- **Foreign key constraints** - Enforces data integrity
- **No cross-user access** - Users cannot access other users' data even with valid IDs

**Application Level:**

- Authorization handled automatically by repository
- No additional service-layer checks needed for user isolation
- User ownership verified at SQL execution level

**Security Guarantees:**

```typescript
// Even if user has valid documentId from another user:
const result = await repo.get(otherUsersDocId, currentUserId);
// Returns NotFoundError - database filters by userId
```

---

## Data Validation

All repositories use **Zod validators** to ensure type safety and data integrity:

```typescript
import zod from 'zod';
import { validate } from '@/utils/validate';
import type { ValidationError } from '@/utils/errors/ValidationError';
import type { Result } from 'neverthrow';

// Define schema
const myEntitySchema = zod.object({
  id: myEntityIdSchema,
  createdAt: zod.date(),
  updatedAt: zod.date(),
  name: zod.string().min(1).max(255),
  value: zod.number().int().positive(),
  schemaVersion: zod.literal(1),
});

type MyEntity = zod.infer<typeof myEntitySchema>;

// Create validator function
function validMyEntity(data: unknown): Result<MyEntity, ValidationError> {
  return validate(myEntitySchema, data);
}

// Pass to repository
new MySharedRepo(appConfig, 'my_table', validMyEntity);
```

**Validation Flow:**

1. Repository receives raw database result (snake_case, ISO strings)
2. `convertQueryResultsToData` parses dates and spreads `data` field
3. Validator function validates against Zod schema
4. Returns validated domain entity or `ValidationError`

---

## Testing Repositories

### Testing Pattern

```typescript
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getMockedRelationalDatabaseAdapter } from '@/lib/repos/adapters/__mocks__/RelationalDatabaseAdapter.mock';
import { MySharedRepo } from './MySharedRepo';

describe('MySharedRepo', () => {
  const mockAdapter = getMockedRelationalDatabaseAdapter();
  const mockCreateAdapter = () => mockAdapter;

  beforeEach(() => {
    mock.restore();
    mockAdapter.findUnique.mockReset();
    mockAdapter.findMany.mockReset();
    mockAdapter.create.mockReset();
    mockAdapter.update.mockReset();
    mockAdapter.delete.mockReset();
  });

  it('should get record by id', async () => {
    mockAdapter.findUnique.mockResolvedValue(
      ok([
        {
          id: 'test-id',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          data: { name: 'Test', value: 42 },
        },
      ]),
    );

    const repo = new MySharedRepo(appConfig, {
      createRelationalDatabaseAdapter: mockCreateAdapter,
    });

    const result = await repo.get(MyEntityId('test-id'));

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().name).toBe('Test');
  });
});
```

### Mock Adapter

```typescript
// From adapters/__mocks__/RelationalDatabaseAdapter.mock.ts
export function getMockedRelationalDatabaseAdapter() {
  return {
    findUnique: mock(),
    findMany: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
    getDB: mock(),
  };
}
```

---

## Advanced Usage

### Direct Database Access

For complex queries not covered by repository methods:

```typescript
const dbResult = repo.getDB();
if (dbResult.isErr()) {
  console.error('Database connection error:', dbResult.error);
  return;
}

const db = dbResult.value;

// Execute custom query
const result = await db`
  SELECT * FROM my_table
  WHERE name ILIKE ${db('%search%')}
  ORDER BY created_at DESC
  LIMIT 10
`;

// Validate and convert to domain entities
const dataResult = convertQueryResultsToData(result, validMyEntity);
```

**When to use:**

- Complex joins across tables
- Aggregations and grouping
- Full-text search
- Custom sorting and filtering

**When NOT to use:**

- Simple CRUD operations (use repository methods)
- User-scoped queries (let StandardRepo handle userId filtering)

### Custom Repository Methods

Extend repository classes for domain-specific operations:

```typescript
export class DocumentsRepo extends StandardRepo<DocumentId, Document> {
  constructor(appConfig: IAppConfigurationService) {
    super(appConfig, 'documents', validDocument);
  }

  // Custom method: Find documents by tag
  async findByTag(
    userId: UserId,
    tag: string,
  ): Promise<Result<Document[], ErrorWithMetadata>> {
    const dbResult = this.getDB(userId);
    if (dbResult.isErr()) return err(dbResult.error);

    const db = dbResult.value;

    const result = await db`
      SELECT * FROM documents
      WHERE user_id = ${db(userId)}
        AND data->>'tags' LIKE ${db(`%${tag}%`)}
    `;

    const validated = validateRawDatabaseQuery(result);
    if (validated.isErr()) return err(validated.error);

    return convertQueryResultsToData(validated.value, validDocument);
  }
}
```

---

## Environment Configuration

### Required Environment Variables

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@localhost:5432/database"
```

### App Configuration Service

The repository layer retrieves `DATABASE_URL` through the `IAppConfigurationService`:

```typescript
interface IAppConfigurationService {
  databaseUrl: string | undefined;
  // ... other config
}
```

**Error Handling:**

- Missing `DATABASE_URL` → Returns `DatabaseError` with metadata from `DatabaseClientFactory`
- Invalid connection string → Returns `ErrorWithMetadata` on connection attempt
- Factory validates configuration before creating clients (fail-fast pattern)

---

## Decision Guide

### When to Use SharedRepo vs StandardRepo

| Criteria           | SharedRepo                  | StandardRepo                   |
| ------------------ | --------------------------- | ------------------------------ |
| **Data Ownership** | No owner                    | Belongs to specific user       |
| **Access Pattern** | Global read/write           | User-scoped read/write         |
| **Security Model** | Service-layer authorization | Database-level isolation       |
| **Use Cases**      | Users, settings, templates  | Documents, preferences, orders |
| **Performance**    | May benefit from caching    | Automatically filtered by user |
| **Schema**         | No `user_id` column         | Requires `user_id` foreign key |

### Examples by Category

**SharedRepo (Global Data):**

- ✅ Users table (with service-layer authorization)
- ✅ System configuration
- ✅ Public templates
- ✅ Global categories/tags
- ✅ API keys (admin-only via service layer)

**StandardRepo (User-Scoped Data):**

- ✅ User documents
- ✅ User preferences
- ✅ User orders
- ✅ User messages
- ✅ User sessions
- ✅ User notifications

---

## Performance Considerations

### Query Optimization

**Indexes:**

```sql
-- Standard tables: Index on user_id for filtering
CREATE INDEX idx_documents_user_id ON documents(user_id);

-- Both tables: Index on commonly queried JSON fields
CREATE INDEX idx_documents_tags ON documents USING GIN ((data->'tags'));
```

**Limiting Results:**

```typescript
// Always use limits for large datasets
const result = await repo.all(userId, { limit: 100 });
```

### Caching Strategy

**SharedRepo:**

```typescript
// Consider caching for frequently accessed global data
import type { ICache } from '@/lib/cache';

class UsersRepo extends SharedRepo<UserId, User> {
  constructor(
    appConfig: IAppConfigurationService,
    private cache: ICache,
  ) {
    super(appConfig, 'users', validUser);
  }

  async get(id: UserId): Promise<Result<User, DBError>> {
    const cached = await this.cache.get(`user:${id}`);
    if (cached) return ok(cached);

    const result = await super.get(id);
    if (result.isOk()) {
      await this.cache.set(`user:${id}`, result.value, 3600);
    }
    return result;
  }
}
```

**StandardRepo:**

- Caching less beneficial due to user-specific data
- Consider short-lived caches for active users only

---

## Migration Guide

### Migrating from Old Repository Pattern

If migrating from a previous repository implementation:

1. **Update Constructor:**

   ```typescript
   // Old
   constructor(db: Database) {
     super(db, myTable, validMyEntity);
   }

   // New
   constructor(appConfig: IAppConfigurationService) {
     super(appConfig, 'my_table', validMyEntity);
   }
   ```

2. **Update Method Calls:**

   ```typescript
   // SharedRepo - no changes to method signatures
   await repo.get(id);
   await repo.all();

   // StandardRepo - add userId parameter
   await repo.get(id, userId);
   await repo.all(userId);
   ```

3. **Update Tests:**

   ```typescript
   // Use new mock adapter
   import { getMockedRelationalDatabaseAdapter } from '@/lib/repos/adapters/__mocks__/RelationalDatabaseAdapter.mock';

   const mockAdapter = getMockedRelationalDatabaseAdapter();
   ```

---

## Architecture Consistency with Cache Layer

The repository layer follows the **exact same client and factory pattern** as the cache layer, ensuring architectural consistency across the codebase.

### Pattern Comparison

| Aspect               | Cache Layer                         | Repository Layer                   |
| -------------------- | ----------------------------------- | ---------------------------------- |
| **Factory Method**   | `getCacheClient(type)`              | `getDatabase(type, table)`         |
| **Type Parameter**   | `CacheClientType`                   | `DatabaseClientType`               |
| **Type Definition**  | `zod.enum(['redis'])`               | `zod.enum(['bun-sql'])`            |
| **Factory Location** | `clients/CacheClientFactory.ts`     | `clients/DatabaseClientFactory.ts` |
| **Client Location**  | `clients/redis/RedisCacheClient.ts` | `clients/bun/BunDatabaseClient.ts` |
| **Mock Structure**   | `clients/__mocks__/`                | `clients/__mocks__/`               |
| **Test Structure**   | `clients/__tests__/`                | `clients/__tests__/`               |

### Shared Benefits

1. **Extensibility**: Easy to add new client types via enum
2. **Type Safety**: Zod validation ensures correct types
3. **Error Handling**: Consistent error metadata patterns
4. **Testability**: Identical mock structure
5. **Developer Experience**: Learn once, apply everywhere

### Adding New Database Types

```typescript
// 1. Update type enum in domain/DatabaseClient.ts
const databaseClients = zod.enum(['bun-sql', 'postgres', 'mysql']);

// 2. Add implementation in clients/
export function createPostgresDatabaseClient(url: string): IDatabaseClient {
  return new PostgresClient(url);
}

// 3. Update factory switch in DatabaseClientFactory.ts
case 'postgres':
  return this.getPostgresClient(table);

// 4. Use with type parameter
const client = factory.getDatabase('postgres', 'users');
```

---

## Best Practices

### ✅ Do's

1. **Use the Right Repository Type**
   - SharedRepo for global data
   - StandardRepo for user-scoped data

2. **Always Handle Result Types**

   ```typescript
   const result = await repo.get(id);
   if (result.isErr()) {
     // Handle error
     return err(result.error);
   }
   const data = result.value;
   ```

3. **Use Domain Validators**
   - Create Zod schemas for all entities
   - Pass validator functions to repository constructor

4. **Implement Dependency Injection**

   ```typescript
   constructor(
     appConfig: IAppConfigurationService,
     dependencies = { createRelationalDatabaseAdapter, ... }
   ) {
     // Enables testing
   }
   ```

5. **Use Branded Types for IDs**
   ```typescript
   const userId = UserId('user-123'); // Type-safe
   const docId = DocumentId('doc-456'); // Won't mix up
   ```

### ❌ Don'ts

1. **Don't Mix Repository Types**
   - Don't use SharedRepo for user-scoped data
   - Don't use StandardRepo for global data

2. **Don't Skip UserId on StandardRepo**

   ```typescript
   // Wrong - StandardRepo always needs userId
   await repo.get(id);

   // Correct
   await repo.get(id, userId);
   ```

3. **Don't Bypass Validation**
   - Always use Zod validators in constructor
   - Don't use `any` or `unknown` for domain types

4. **Don't Ignore Errors**

   ```typescript
   // Bad - ignores errors
   const data = (await repo.get(id))._unsafeUnwrap();

   // Good - handles errors
   const result = await repo.get(id);
   if (result.isErr()) return err(result.error);
   const data = result.value;
   ```

5. **Don't Store Sensitive Data Unencrypted**
   - Use encryption services before storing
   - Repository layer doesn't encrypt automatically

---

## Troubleshooting

### Common Issues

**Issue: `DATABASE_URL` not configured**

```
Error: Database URL is not configured
```

**Solution:** Set `DATABASE_URL` environment variable

**Issue: Validation error on get()**

```
ValidationError: Validation failed
```

**Solution:** Check Zod schema matches database `data` structure. Use migrations to update schema version.

**Issue: NotFoundError on StandardRepo**

```
NotFoundError: Record not found
```

**Cause:** Either record doesn't exist OR user doesn't own it
**Solution:** Verify userId is correct and record belongs to user

**Issue: Type errors with branded IDs**

```
Type 'string' is not assignable to type 'UserId'
```

**Solution:** Use ID constructor: `UserId('user-123')` not just `'user-123'`

---

## Related Documentation

- [Domain Layer](/src/lib/domain/README.md) - Entity definitions and validators
- [Services Layer](/src/lib/services/README.md) - Business logic using repositories
- [Testing Guide](/docs/testing.md) - Comprehensive testing strategies
- [Database Migrations](/docs/migrations.md) - Schema evolution

---

## Summary

The repository layer provides a robust, type-safe abstraction over database operations with:

- **Two repository patterns** (Shared vs Standard) for different security models
- **Layered architecture** (Repository → Adapter → Factory → DB Client)
- **Progressive SQL building** with parameterized queries
- **Automatic validation** with Zod schemas
- **Functional error handling** with Result types
- **Built-in security** for user-scoped data
- **Comprehensive testing** with mock adapters

This architecture ensures **separation of concerns**, **type safety**, and **security by default** for all database operations.
