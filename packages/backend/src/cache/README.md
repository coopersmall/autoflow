# Cache Layer Documentation

## Overview

The cache layer provides a **clean, type-safe abstraction** over Redis caching operations using a **layered architecture pattern**. It supports two distinct caching patterns optimized for different data scoping models:

- **SharedCache**: For globally accessible data without user ownership (e.g., users, system settings, public data)
- **StandardCache**: For user-scoped data with automatic isolation between users (e.g., integrations, secrets, user preferences)

Both cache classes use the **adapter pattern** to abstract Redis operations, ensuring type safety through Zod validation and providing functional error handling with `Result` types.

---

## Architecture Overview

### Layered Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│  Domain Layer (Services, Business Logic)                │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│  Cache Layer                                             │
│  ├─ SharedCache    (global data, no userId)            │
│  └─ StandardCache  (user-scoped, requires userId)      │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│  Adapter Layer                                           │
│  └─ CacheAdapter                                         │
│     (serialization, validation, error handling)         │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│  Client Layer                                            │
│  ├─ CacheClientFactory (client instantiation)          │
│  └─ Redis Client (ioredis wrapper)                      │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
src/lib/cache/
├── README.md                       # This file
├── REFACTORING_PLAN.md            # Architecture evolution plan
├── SharedCache.ts                  # Global data cache
├── StandardCache.ts                # User-scoped cache
├── actions/
│   ├── convertCacheData.ts         # Serialization/deserialization
│   ├── generateCacheKey.ts         # Key generation utilities
│   └── __tests__/
│       ├── convertCacheData.test.ts
│       └── generateCacheKey.test.ts
├── adapters/
│   ├── CacheAdapter.ts             # Cache operations abstraction
│   ├── __mocks__/
│   │   └── CacheAdapter.mock.ts
│   └── __tests__/
│       └── CacheAdapter.test.ts
├── clients/
│   ├── CacheClient.ts              # Cache client interface
│   ├── CacheClientFactory.ts       # Client factory
│   ├── redis/
│   │   └── RedisCacheClient.ts     # Redis implementation
│   ├── __mocks__/
│   │   ├── CacheClient.mock.ts
│   │   └── CacheClientFactory.mock.ts
│   └── __tests__/
│       └── CacheClientFactory.test.ts
├── domain/
│   ├── Cache.ts                    # ICacheClient, ICacheClientFactory
│   └── CacheAdapter.ts             # ICacheAdapter interface
├── errors/
│   └── CacheError.ts               # Error factory functions
└── __tests__/
    ├── SharedCache.test.ts
    └── StandardCache.test.ts
```

---

## Core Components

### 1. Cache Layer (SharedCache & StandardCache)

**Responsibilities:**

- Provide domain-friendly cache operations (get, set, del)
- Validate all cached data with Zod schemas
- Implement cache-aside pattern with onMiss callbacks
- Handle errors with `Result` types
- Generate cache keys using consistent patterns

**Key Differences:**

| Feature              | SharedCache                 | StandardCache                    |
| -------------------- | --------------------------- | -------------------------------- |
| **User Scoping**     | None                        | Required on all operations       |
| **Method Signature** | `get(id)`                   | `get(id, userId)`                |
| **Key Pattern**      | `{namespace}/{id}`          | `user/{userId}/{namespace}/{id}` |
| **Use Cases**        | Users, system settings      | User integrations, secrets       |
| **Security Model**   | Service-layer authorization | Cache-level isolation            |

### 2. Adapter Layer (CacheAdapter)

**Responsibilities:**

- Serialize domain entities to JSON strings
- Deserialize and validate cached data
- Execute Redis operations via cache client
- Wrap errors in standardized `ErrorWithMetadata`

**Data Flow:**

```
Domain Entity (TypeScript objects)
         ↓
  serializeCacheData()
         ↓
  JSON String → Redis
         ↓
  JSON String ← Redis
         ↓
  deserializeCacheData()
         ↓
  Validated Entity (Zod)
```

### 3. Client Layer (CacheClient & CacheClientFactory)

**Responsibilities:**

- Define cache client interface (`ICacheClient`)
- Create Redis client instances (`CacheClientFactory`)
- Validate Redis URL configuration
- Return `Result` types for error handling
- Provide dependency injection for testing

### 4. Action Layer (generateCacheKey & convertCacheData)

**Responsibilities:**

- Generate consistent cache keys
- Handle JSON serialization/deserialization
- Validate data schemas with Zod
- Provide reusable utility functions

**Key Generation:**

```typescript
// SharedCache
generateSharedCacheKey('users', 'user-123');
// → "users/user-123"

// StandardCache
generateStandardCacheKey('integrations', 'int-456', 'user-123');
// → "user/user-123/integrations/int-456"
```

---

## Redis Data Schema

### Cached Value Structure

All cached values are stored as JSON strings:

```json
{
  "id": "entity-123",
  "name": "Example Entity",
  "value": 42,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "schemaVersion": 1
}
```

**Key Conventions:**

- **Namespace**: lowercase, hyphen-separated (e.g., `users`, `user-integrations`)
- **IDs**: branded string types for type safety
- **Dates**: ISO 8601 timestamp strings
- **Schema Version**: Integer for data migration support

---

## Creating Cache Instances

### Creating a SharedCache

For globally accessible data:

```typescript
import { SharedCache } from '@/lib/cache/SharedCache';
import type { IAppConfigurationService } from '@/lib/services/configuration/AppConfigurationService';
import type { MyEntity, MyEntityId } from '@/lib/domain/myEntity/myEntity';
import { validMyEntity } from '@/lib/domain/myEntity/validation/validMyEntity';
import type { ILogger } from '@/utils/logger/Logger';

interface MyEntityCacheContext {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  validator: Validator<MyEntity>;
}

export class MyEntityCache extends SharedCache<MyEntityId, MyEntity> {
  constructor(ctx: { logger: ILogger; appConfig: IAppConfigurationService }) {
    super(
      'my-entities', // Namespace
      {
        logger: ctx.logger,
        appConfig: ctx.appConfig,
        validator: validMyEntity,
      },
    );
  }
}
```

### Creating a StandardCache

For user-scoped data:

```typescript
import { StandardCache } from '@/lib/cache/StandardCache';
import type { IAppConfigurationService } from '@/lib/services/configuration/AppConfigurationService';
import type { MyEntity, MyEntityId } from '@/lib/domain/myEntity/myEntity';
import { validMyEntity } from '@/lib/domain/myEntity/validation/validMyEntity';
import type { ILogger } from '@/utils/logger/Logger';

export class MyUserEntityCache extends StandardCache<MyEntityId, MyEntity> {
  constructor(ctx: { logger: ILogger; appConfig: IAppConfigurationService }) {
    super(
      'my-user-entities', // Namespace
      {
        logger: ctx.logger,
        appConfig: ctx.appConfig,
        validator: validMyEntity,
      },
    );
  }
}
```

---

## Method Signatures

### SharedCache Methods

```typescript
class SharedCache<ID extends Id<string>, T extends Item<ID>> {
  // Retrieve from cache with optional onMiss callback
  async get(
    id: ID,
    onMiss?: (id: ID) => Promise<Result<T, ErrorWithMetadata>>,
  ): Promise<Result<T, ErrorWithMetadata>>;

  // Store in cache with TTL
  async set(
    id: ID,
    item: T,
    ttl?: number, // Default: 3600 seconds
  ): Promise<Result<void, ErrorWithMetadata>>;

  // Delete from cache
  async del(id: ID): Promise<Result<void, ErrorWithMetadata>>;
}
```

### StandardCache Methods

```typescript
class StandardCache<ID extends Id<string>, T extends Item<ID>> {
  // Retrieve from cache (user-scoped) with optional onMiss callback
  async get(
    id: ID,
    userId: UserId,
    onMiss?: (id: ID, userId: UserId) => Promise<Result<T, ErrorWithMetadata>>,
  ): Promise<Result<T, ErrorWithMetadata>>;

  // Store in cache (user-scoped) with TTL
  async set(
    item: T, // Must include id property
    userId: UserId,
    ttl?: number, // Default: 3600 seconds
  ): Promise<Result<void, ErrorWithMetadata>>;

  // Delete from cache (user-scoped)
  async del(id: ID, userId: UserId): Promise<Result<void, ErrorWithMetadata>>;
}
```

---

## Usage Examples

### Using SharedCache (Global Data)

```typescript
import { UsersCache } from '@/lib/cache/users/UsersCache';
import { UserId } from '@/lib/domain/user/user';

const cache = new UsersCache({ logger, appConfig });

// Get with cache-aside pattern
const result = await cache.get(UserId('user-123'), async (id) => {
  // Called on cache miss
  return await userRepo.get(id);
});

if (result.isErr()) {
  logger.error('Cache get failed', result.error);
  return;
}

const user = result.value;

// Set with custom TTL
const setResult = await cache.set(
  UserId('user-456'),
  user,
  7200, // 2 hours
);

// Delete
const delResult = await cache.del(UserId('user-789'));
```

### Using StandardCache (User-Scoped Data)

```typescript
import { IntegrationsCache } from '@/lib/cache/integrations/IntegrationsCache';
import { IntegrationId } from '@/lib/domain/integration/integration';
import { UserId } from '@/lib/domain/user/user';

const cache = new IntegrationsCache({ logger, appConfig });
const userId = UserId('user-123');

// Get with cache-aside pattern (user-isolated)
const result = await cache.get(
  IntegrationId('int-456'),
  userId,
  async (id, userId) => {
    // Called on cache miss - automatically scoped to user
    return await integrationsRepo.get(id, userId);
  },
);

if (result.isErr()) {
  logger.error('Cache get failed', result.error);
  return;
}

const integration = result.value;

// Set (uses integration.id from the item)
const setResult = await cache.set(integration, userId);

// Delete (user-scoped)
const delResult = await cache.del(IntegrationId('int-789'), userId);
```

### Cache-Aside Pattern

Both cache types implement automatic cache-aside:

```typescript
// 1. Cache hit → returns cached data
const hit = await cache.get(id, async () => {
  // Not called - data already in cache
  return await repo.get(id);
});

// 2. Cache miss → calls onMiss, caches result, returns data
const miss = await cache.get(id, async () => {
  // Called because cache is empty
  const data = await repo.get(id);
  return data; // Automatically cached for next request
});

// 3. No onMiss → returns error on cache miss
const noCallback = await cache.get(id);
// Returns error if not in cache
```

---

## Error Handling

### Error Types

All cache operations return `Result<T, ErrorWithMetadata>`:

```typescript
const result = await cache.get(id);

if (result.isErr()) {
  const error = result.error;

  switch (error.name) {
    case 'NotFound':
      // Cache miss
      logger.debug('Cache miss', { id });
      break;
    case 'ValidationError':
      // Cached data failed Zod validation
      logger.error('Cache validation failed', error);
      break;
    case 'InternalServer':
      // Redis connection error or serialization failure
      logger.error('Cache error', error);
      break;
  }

  return;
}

const data = result.value; // Type-safe, validated data
```

### Error Recovery

Cache failures should be graceful:

```typescript
// ❌ Bad - throws on cache failure
const user = (await cache.get(id))._unsafeUnwrap();

// ✅ Good - graceful fallback
const cacheResult = await cache.get(id);
const user = cacheResult.isOk()
  ? cacheResult.value
  : (await repo.get(id))._unsafeUnwrap();

// ✅ Best - cache-aside pattern handles this automatically
const user = (await cache.get(id, (id) => repo.get(id)))._unsafeUnwrap();
```

---

## Testing

### Unit Testing with Mocks

```typescript
import { SharedCache } from '@/lib/cache/SharedCache';
import { getMockedCacheAdapter } from '@/lib/cache/adapters/__mocks__/CacheAdapter.mock';
import { getMockedCacheClientFactory } from '@/lib/cache/factory/__mocks__/CacheClientFactory.mock';
import { getMockedAppConfigurationService } from '@/lib/services/configuration/__mocks__/AppConfigurationService.mock';
import { mock } from 'bun:test';
import { ok, err } from 'neverthrow';

describe('MyCache', () => {
  let mockAdapter: ReturnType<typeof getMockedCacheAdapter>;
  let mockAppConfig: ReturnType<typeof getMockedAppConfigurationService>;
  let mockLogger: { debug: any; info: any; error: any };
  let cache: SharedCache<MyEntityId, MyEntity>;

  beforeEach(() => {
    mockAdapter = getMockedCacheAdapter();
    mockAppConfig = getMockedAppConfigurationService();
    mockLogger = {
      debug: mock(),
      info: mock(),
      error: mock(),
    };

    const mockCreateCacheClientFactory = mock(() =>
      getMockedCacheClientFactory(),
    );
    const mockCreateCacheAdapter = mock(() => mockAdapter);
    const mockGenerateKey = mock(
      (namespace: string, id: string) => `${namespace}/${id}`,
    );

    cache = new SharedCache(
      'test-namespace',
      { logger: mockLogger, appConfig: mockAppConfig, validator },
      {
        createCacheClientFactory: mockCreateCacheClientFactory,
        createCacheAdapter: mockCreateCacheAdapter,
        generateCacheKey: mockGenerateKey,
      },
    );
  });

  it('should get from cache', async () => {
    const testItem = { id: MyEntityId('test-1'), name: 'Test' };
    mockAdapter.get.mockResolvedValue(ok(testItem));

    const result = await cache.get(MyEntityId('test-1'));

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(testItem);
  });
});
```

### Integration Testing

```typescript
describe('Cache Integration', () => {
  it('should handle cache-aside pattern', async () => {
    const cache = new MyCache({ logger, appConfig });
    const repo = new MyRepo(appConfig);

    // First call - cache miss, calls repo
    const result1 = await cache.get(id, (id) => repo.get(id));
    expect(result1.isOk()).toBe(true);

    // Second call - cache hit, doesn't call repo
    const result2 = await cache.get(id);
    expect(result2.isOk()).toBe(true);
    expect(result2.value).toEqual(result1.value);
  });
});
```

---

## Best Practices

### 1. Always Use Validators

```typescript
// ❌ Bad - no validation
const cache = new SharedCache('items', {
  logger,
  appConfig,
  validator: (x) => ok(x),
});

// ✅ Good - proper Zod validation
import { validMyEntity } from '@/lib/domain/myEntity/validation/validMyEntity';
const cache = new SharedCache('items', {
  logger,
  appConfig,
  validator: validMyEntity,
});
```

### 2. Choose the Right Cache Type

```typescript
// ❌ Bad - using SharedCache for user data
const userDocs = new SharedCache<DocId, Doc>('documents', ctx);
await userDocs.get(docId); // No user isolation!

// ✅ Good - using StandardCache for user data
const userDocs = new StandardCache<DocId, Doc>('documents', ctx);
await userDocs.get(docId, userId); // User-isolated
```

### 3. Handle Cache Failures Gracefully

```typescript
// ❌ Bad - cache failure breaks app
const user = (await cache.get(id))._unsafeUnwrap();

// ✅ Good - graceful degradation
const result = await cache.get(id, (id) => repo.get(id));
if (result.isErr()) {
  logger.error('Cache failed', result.error);
  // App continues - repo was called on cache miss
}
```

### 4. Use Appropriate TTLs

```typescript
// Short-lived data (5 minutes)
await cache.set(id, data, 300);

// Medium-lived data (1 hour) - default
await cache.set(id, data);

// Long-lived data (24 hours)
await cache.set(id, data, 86400);
```

### 5. Namespace Conventions

```typescript
// ✅ Good - lowercase, hyphen-separated
new SharedCache('users', ctx);
new SharedCache('system-settings', ctx);
new StandardCache('user-integrations', ctx);

// ❌ Bad - inconsistent naming
new SharedCache('Users', ctx);
new SharedCache('system_settings', ctx);
new StandardCache('UserIntegrations', ctx);
```

### 6. Invalidate on Updates

```typescript
// Update entity in database
const updateResult = await repo.update(id, data);
if (updateResult.isErr()) return updateResult;

// Invalidate cache
await cache.del(id);

// Or update cache directly
await cache.set(id, updateResult.value);
```

---

## Decision Guide: Shared vs Standard

### Use SharedCache when:

- ✅ Data is globally accessible (e.g., user profiles, system config)
- ✅ No user ownership or scoping required
- ✅ All users see the same data for a given ID
- ✅ Authorization handled at service layer

**Examples:**

- Users table
- System settings
- Public templates
- Feature flags

### Use StandardCache when:

- ✅ Data belongs to specific users
- ✅ Users should NOT see each other's data
- ✅ Cache isolation required for security
- ✅ Multi-tenancy or privacy requirements

**Examples:**

- User integrations
- User secrets
- User preferences
- Private documents

---

## Performance Considerations

### Cache Hit Rates

Monitor cache effectiveness:

```typescript
let hits = 0;
let misses = 0;

const result = await cache.get(id, async (id) => {
  misses++;
  return await repo.get(id);
});

if (result.isOk()) {
  hits++;
}

const hitRate = hits / (hits + misses);
logger.info('Cache hit rate', { hitRate });
```

### TTL Tuning

Adjust TTL based on data characteristics:

- **Rarely changes**: Longer TTL (24+ hours)
- **Frequently updated**: Shorter TTL (5-15 minutes)
- **Real-time**: Very short TTL or skip caching

### Memory Management

Redis memory is finite:

- Use appropriate TTLs to auto-expire
- Monitor Redis memory usage
- Consider eviction policies (LRU recommended)
- Avoid caching very large objects (>1MB)

---

## Troubleshooting

### Common Issues

**1. ValidationError on cache get**

```
Problem: Cached data fails Zod validation
Cause: Schema changed but cached data is old format
Solution: Clear cache or bump schemaVersion
```

**2. Cache always missing**

```
Problem: Cache-aside onMiss always called
Cause: TTL too short or Redis connection issue
Solution: Check Redis connectivity, increase TTL
```

**3. Wrong data returned**

```
Problem: User sees another user's data
Cause: Using SharedCache instead of StandardCache
Solution: Switch to StandardCache for user-scoped data
```

### Debug Logging

Enable cache debug logging:

```typescript
const cache = new SharedCache('items', {
  logger: createLogger({ level: 'debug' }),
  appConfig,
  validator,
});

// Logs all cache operations:
// - Cache hits/misses
// - Serialization/deserialization
// - Key generation
// - Errors and validation failures
```

---

## Migration Guide

### From Old Cache Pattern

**Before:**

```typescript
// Old pattern - direct client usage
const cache = new SharedCache('users', { client, logger, validator });
```

**After:**

```typescript
// New pattern - appConfig injection
const cache = new SharedCache('users', { appConfig, logger, validator });
```

### Updating Existing Caches

1. Change constructor parameter from `client` to `appConfig`
2. Update imports to use new cache classes
3. Run tests to verify functionality
4. Deploy with feature flag if needed

---

## References

- [Repository Layer Architecture](/src/lib/repos/README.md) - Similar pattern
- [Refactoring Plan](/src/lib/cache/REFACTORING_PLAN.md) - Architecture evolution
- [ioredis Documentation](https://github.com/redis/ioredis) - Redis client library

---

**Last Updated**: 2025-11-15  
**Architecture Version**: 2.0 (Layered Architecture)
