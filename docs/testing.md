# Testing Guide

Autoflow uses [Bun's test runner](https://bun.sh/docs/cli/test) with a focus on **integration testing** and **property-based testing**. This guide covers our testing philosophy, patterns, and best practices.

## Testing Philosophy

Our testing approach prioritizes real behavior over mocked behavior:

| Priority | Test Type | Purpose |
|----------|-----------|---------|
| **1st** | Integration tests | Test real behavior with real infrastructure |
| **2nd** | Property tests | Verify invariants that must hold for all inputs |
| **3rd** | Unit tests | Only for specific edge cases not covered above |

### Why This Approach?

1. **Integration tests catch real bugs** - Testing with real databases and caches catches issues that mocked tests miss
2. **Property tests find edge cases** - Random input generation discovers bugs that fixed examples never would
3. **Less mocking = less maintenance** - Mocks often test implementation details, not behavior
4. **Confidence in refactoring** - Integration tests don't break when you change internal implementation

### When to Use Each Type

| Use Integration Tests For | Use Property Tests For | Use Unit Tests For |
|---------------------------|------------------------|-------------------|
| Service CRUD operations | Data round-trips (encrypt/decrypt) | Time-dependent behavior |
| HTTP handler responses | Validation (accept valid, reject invalid) | Specific error messages |
| Database queries | Security properties (isolation, uniqueness) | Helper API testing |
| Cache behavior | State transitions | One-off edge cases |
| End-to-end flows | Input/output preservation | Complex algorithms |

## Quick Reference

```bash
make test              # Run all unit tests
make test-integration  # Run integration tests (starts Docker)
make tsc               # Type check
make lint              # Lint check
```

## Test File Organization

### Naming Conventions

| Type | Pattern | Location |
|------|---------|----------|
| Integration tests | `*.integration.test.ts` | `__tests__/` folder |
| Unit tests | `*.test.ts` | `__tests__/` folder next to source |
| Mocks | `*.mock.ts` | `__mocks__/` folder next to source |

### Directory Structure

```
src/services/users/
├── UsersService.ts
├── __tests__/
│   └── UsersService.integration.test.ts  # Primary test file
├── __mocks__/
│   └── UsersService.mock.ts              # Only if needed elsewhere
└── repos/
    └── UsersRepo.ts
```

## Integration Testing

Integration tests are the **primary form of testing** in Autoflow. They test real behavior with real PostgreSQL and Redis instances.

### Basic Setup

```typescript
import { describe, expect, it } from 'bun:test';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { createUsersService } from '@backend/users';

describe('UsersService Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  const setup = () => {
    return createUsersService({
      appConfig: getConfig(),
      logger: getLogger(),
    });
  };

  describe('create()', () => {
    it('should create a user in database and cache', async () => {
      const service = setup();

      const result = await service.create(createMockContext(), {
        schemaVersion: 1,
      });

      expect(result.isOk()).toBe(true);
      const user = result._unsafeUnwrap();
      expect(user.id).toBeDefined();
      expect(user.schemaVersion).toBe(1);
    });
  });

  describe('get()', () => {
    it('should retrieve created user', async () => {
      const service = setup();

      // Create
      const createResult = await service.create(createMockContext(), {
        schemaVersion: 1,
      });
      const created = createResult._unsafeUnwrap();

      // Get
      const getResult = await service.get(createMockContext(), created.id);

      expect(getResult.isOk()).toBe(true);
      expect(getResult._unsafeUnwrap().id).toBe(created.id);
    });
  });
});
```

### HTTP Handler Integration Tests

```typescript
import { beforeAll, describe, expect, it } from 'bun:test';
import { setupHttpIntegrationTest } from '@backend/testing/integration/httpIntegrationTest';
import { createAPIUserHandlers } from '@backend/users/handlers/http/UsersHttpHandler';
import { validUser } from '@core/domain/user/validation/validUser';

describe('UsersHttpHandler Integration Tests', () => {
  const {
    getHttpServer,
    getHttpClient,
    getTestAuth,
    getConfig,
    getLogger,
    getRouteFactory,
  } = setupHttpIntegrationTest();

  beforeAll(async () => {
    const config = getConfig();
    const logger = getLogger();
    const routeFactory = getRouteFactory();

    const handlers = [
      createAPIUserHandlers({
        logger,
        appConfig: config,
        routeFactory,
      }),
    ];

    await getHttpServer().start(handlers);
  });

  describe('POST /api/users', () => {
    it('should create user with admin token (201)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const response = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers },
      );

      expect(response.status).toBe(201);

      const result = await client.parseJson(response, validUser);
      expect(result.isOk()).toBe(true);
    });

    it('should return 401 when no auth header provided', async () => {
      const client = getHttpClient();

      const response = await client.post('/api/users', { schemaVersion: 1 });

      expect(response.status).toBe(401);
    });

    it('should return 403 when token has no permissions', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const token = await auth.createUnauthorizedToken();
      const headers = auth.createBearerHeaders(token);

      const response = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers },
      );

      expect(response.status).toBe(403);
    });
  });
});
```

### Running Integration Tests

```bash
# Starts Docker containers, runs tests, stops containers
make test-integration

# Manual control
make test-start   # Start containers
bun run test:integration
make test-stop    # Stop containers
```

## Property-Based Testing

Property-based tests verify **invariants** that must hold for ALL valid inputs. They use the `fast-check` library to generate random test data.

### Why Property Tests?

| Fixed Examples | Property Tests |
|----------------|----------------|
| Test 1-3 specific inputs | Test 20-100 random inputs |
| Miss edge cases | Discover edge cases automatically |
| Brittle to changes | Robust to implementation changes |
| Test what you think of | Test what you didn't think of |

### Basic Structure

```typescript
import { describe, expect, it } from 'bun:test';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import * as fc from 'fast-check';

describe('SecretsService Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  describe('Property Tests', () => {
    // Define arbitraries once at the top
    const stringValueArb = fc.string({ minLength: 0, maxLength: 10000 });
    const secretNameArb = fc.string({ minLength: 1, maxLength: 255 });

    it('should encrypt and decrypt any string value', async () => {
      const service = setup();

      await fc.assert(
        fc.asyncProperty(stringValueArb, async (value) => {
          // Store secret
          const storeResult = await service.store(ctx, {
            name: 'test-secret',
            value,
          });
          expect(storeResult.isOk()).toBe(true);

          // Reveal secret
          const revealResult = await service.reveal(ctx, storeResult.value.id);
          expect(revealResult.isOk()).toBe(true);

          // Value should round-trip exactly
          expect(revealResult.value).toBe(value);
        }),
        { numRuns: 50 },
      );
    });

    it('should produce unique ciphertext for same plaintext (salt uniqueness)', async () => {
      const service = setup();

      await fc.assert(
        fc.asyncProperty(stringValueArb, async (value) => {
          const result1 = await service.store(ctx, { name: 'secret1', value });
          const result2 = await service.store(ctx, { name: 'secret2', value });

          // Same plaintext should produce different ciphertext
          expect(result1.value.encryptedValue).not.toBe(result2.value.encryptedValue);
        }),
        { numRuns: 50 },
      );
    });
  });
});
```

### Arbitrary Design Patterns

```typescript
// Enum values - use constantFrom
const statusArb = fc.constantFrom('pending', 'active', 'completed', 'failed');

// Strings with bounds
const nameArb = fc.string({ minLength: 1, maxLength: 255 });

// Unicode strings for special character handling
const unicodeArb = fc.unicodeString({ minLength: 1, maxLength: 1000 });

// JSON objects (not null/primitives)
const jsonPayloadArb = fc.dictionary(
  fc.string(),
  fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
);

// Optional fields
const optionalArb = fc.option(fc.boolean(), { nil: undefined });

// Invalid inputs (for rejection tests)
const invalidStatusArb = fc.string().filter(
  (s) => !['pending', 'active', 'completed', 'failed'].includes(s),
);

// Records with optional keys
const filterArb = fc.record(
  {
    status: fc.option(statusArb, { nil: undefined }),
    limit: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
  },
  { requiredKeys: [] },
);

// Varying counts for batch tests
const countArb = fc.integer({ min: 2, max: 10 });
```

### numRuns Guidelines

| Test Type | Recommended numRuns | Rationale |
|-----------|---------------------|-----------|
| Security properties (encryption, isolation) | 50 | Critical - need high confidence |
| Data preservation (round-trip) | 50 | Important for correctness |
| Validation (reject invalid) | 30 | Good coverage of invalid space |
| Status/enum transitions | 20 | Limited valid states |
| HTTP request validation | 30 | Balance speed and coverage |

### Real Examples

#### Validation Property Tests

```typescript
describe('Property Tests', () => {
  const validPayloadArb = fc.record({
    message: fc.string({ minLength: 1, maxLength: 1000 }),
    shouldFail: fc.option(fc.boolean(), { nil: undefined }),
  });

  const invalidPayloadArb = fc.oneof(
    fc.record({ wrongField: fc.string() }),
    fc.record({ message: fc.integer() }), // wrong type
    fc.constant(null),
    fc.constant('not an object'),
  );

  it('should accept all valid payloads', async () => {
    await fc.assert(
      fc.asyncProperty(validPayloadArb, async (payload) => {
        const result = await scheduler.schedule(ctx, task, payload);
        expect(result.isOk()).toBe(true);
      }),
      { numRuns: 30 },
    );
  });

  it('should reject all invalid payloads', async () => {
    await fc.assert(
      fc.asyncProperty(invalidPayloadArb, async (payload) => {
        const result = await scheduler.schedule(ctx, task, payload as TestPayload);
        expect(result.isErr()).toBe(true);
      }),
      { numRuns: 30 },
    );
  });
});
```

#### CRUD Consistency Property Tests

```typescript
it('should maintain CRUD consistency for all operations', async () => {
  const { usersService, usersRepo, usersCache } = setup();

  await fc.assert(
    fc.asyncProperty(fc.constant(1), async (schemaVersion) => {
      // Create
      const createResult = await usersService.create(ctx, { schemaVersion });
      expect(createResult.isOk()).toBe(true);
      const user = createResult._unsafeUnwrap();

      // Read from all layers
      const serviceGet = await usersService.get(ctx, user.id);
      const cacheGet = await usersCache.get(ctx, user.id);
      const repoGet = await usersRepo.get(ctx, user.id);

      expect(serviceGet._unsafeUnwrap()).toEqual(user);
      expect(cacheGet._unsafeUnwrap()).toEqual(user);
      expect(repoGet._unsafeUnwrap()).toEqual(user);

      // Delete and verify removal
      await usersService.delete(ctx, user.id);
      expect((await usersService.get(ctx, user.id)).isErr()).toBe(true);
    }),
    { numRuns: 20 },
  );
});
```

### When NOT to Use Property Tests

1. **Time-dependent behavior** - Tests with real delays, timeouts
2. **External service interactions** - Tests needing real workers
3. **Specific error messages** - When exact error text matters
4. **One-off edge cases** - Malformed data that doesn't fit a pattern
5. **Fixed configuration** - Testing specific config values

## Unit Testing

Unit tests should be used **sparingly** - only for cases that integration and property tests can't cover well.

### When to Use Unit Tests

| Good Use Cases | Bad Use Cases (Use Integration Instead) |
|----------------|----------------------------------------|
| Pure algorithm testing | Service CRUD operations |
| Time-dependent logic (delays, timeouts) | Database queries |
| Specific error message validation | HTTP responses |
| Helper utility functions | Cache behavior |
| Complex calculation logic | End-to-end flows |

### Basic Structure

```typescript
import { describe, expect, it } from 'bun:test';

describe('calculateRetryDelay', () => {
  it('should apply exponential backoff', () => {
    expect(calculateRetryDelay(1)).toBe(100);
    expect(calculateRetryDelay(2)).toBe(200);
    expect(calculateRetryDelay(3)).toBe(400);
  });

  it('should cap at maximum delay', () => {
    expect(calculateRetryDelay(10)).toBe(MAX_DELAY);
  });
});
```

### Testing Result Types

Always check `isOk()` or `isErr()` before accessing values:

```typescript
it('should return ok result with valid data', () => {
  const result = someFunction(validInput);

  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toBeDefined();
  }
});

it('should return error with invalid data', () => {
  const result = someFunction(invalidInput);

  expect(result.isErr()).toBe(true);
  if (result.isErr()) {
    expect(result.error.message).toContain('expected text');
  }
});
```

## Creating Mocks

Mocks should be used **sparingly** - primarily for injecting test doubles into code that requires them, not as a substitute for integration tests.

### Type-Safe Mocks

```typescript
// __mocks__/UsersService.mock.ts
import type { IUsersService } from '@backend/users/domain/UsersService';
import type { ExtractMockMethods } from '@core/types';
import { mock } from 'bun:test';

export function getMockedUsersService(): ExtractMockMethods<IUsersService> {
  return {
    get: mock(),
    all: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
  };
}
```

### When Mocks Are Appropriate

| Appropriate | Not Appropriate |
|-------------|-----------------|
| External API clients | Database operations |
| Email/SMS services | Cache operations |
| Third-party SDKs | Service-to-service calls |
| System clock/time | Internal business logic |

## Test Best Practices

### 1. Prefer Integration Tests

```typescript
// Prefer: Real database test
it('should create and retrieve user', async () => {
  const service = createUsersService({ appConfig, logger });
  
  const created = await service.create(ctx, { schemaVersion: 1 });
  const retrieved = await service.get(ctx, created._unsafeUnwrap().id);
  
  expect(retrieved.isOk()).toBe(true);
});

// Avoid: Heavily mocked test
it('should create and retrieve user', async () => {
  mockRepo.create.mockResolvedValue(ok(mockUser));
  mockRepo.get.mockResolvedValue(ok(mockUser));
  mockCache.set.mockResolvedValue(ok(undefined));
  // ... tests implementation details, not behavior
});
```

### 2. Use Property Tests for Invariants

```typescript
// Prefer: Property test that verifies invariant
it('should preserve data through round-trip', async () => {
  await fc.assert(
    fc.asyncProperty(fc.string(), async (value) => {
      const encrypted = await encrypt(value);
      const decrypted = await decrypt(encrypted);
      expect(decrypted).toBe(value);
    }),
  );
});

// Avoid: Single example that might miss edge cases
it('should encrypt and decrypt', async () => {
  const encrypted = await encrypt('hello');
  const decrypted = await decrypt(encrypted);
  expect(decrypted).toBe('hello');
});
```

### 3. Isolate Tests

Each test should be independent - don't share state between tests:

```typescript
// Good: Tests are isolated
it('creates user', async () => {
  const user = await service.create(ctx, data);
  expect(user.isOk()).toBe(true);
});

it('updates user', async () => {
  const user = await service.create(ctx, data); // Fresh data
  const updated = await service.update(ctx, user._unsafeUnwrap().id, newData);
  expect(updated.isOk()).toBe(true);
});
```

### 4. Name Tests Descriptively

```typescript
// Good
it('should return 401 when no auth header provided', () => {});
it('should reject payloads missing required message field', () => {});

// Bad
it('works', () => {});
it('test auth', () => {});
```

### 5. Use Factory Functions

```typescript
// Good
const userId = UserId();
const user = await service.create(ctx, { schemaVersion: 1 });

// Bad - hard-coded values
const userId = 'user-123';
```

## Coverage Goals

| Test Type | Goal | Purpose |
|-----------|------|---------|
| Integration tests | Primary coverage | Test real behavior with real infrastructure |
| Property tests | Invariant coverage | Verify properties hold for all inputs |
| Unit tests | Edge case coverage | Only for specific cases above can't cover |

**Focus on behavior coverage, not line coverage.** A well-designed integration test covers more meaningful behavior than many unit tests with mocks.

## Debugging Tests

### Running Single Test

```bash
bun test path/to/file.test.ts
bun test --grep "test name pattern"
```

### Property Test Failures

When a property test fails, fast-check provides:
- **Seed**: Reproduce exact failure with `{ seed: 12345 }`
- **Counterexample**: The input that caused failure
- **Shrunk**: Simplified version of failing input

```typescript
// Reproduce a specific failure
await fc.assert(
  fc.asyncProperty(arb, async (value) => { /* ... */ }),
  { seed: 12345, path: "0:1:2" }, // From failure output
);
```

### Test Timeouts

```typescript
it('should complete within timeout', async () => {
  const result = await longRunningOperation();
  expect(result).toBeDefined();
}, 10000); // 10 second timeout
```

## Next Steps

- [Services Guide](./services.md) - Build testable services
- [Architecture Guide](./architecture.md) - Understand Result types
- [Domain Modeling Guide](./domain-modeling.md) - Test domain validation
- [HTTP Handlers Guide](./http-handlers.md) - Test HTTP endpoints

## Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [fast-check Documentation](https://fast-check.dev/)
- [neverthrow Documentation](https://github.com/supermacro/neverthrow)
