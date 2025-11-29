# Testing Guide

Autoflow uses [Bun's test runner](https://bun.sh/docs/cli/test) for unit and integration tests. This guide covers testing patterns, best practices, and how to write effective tests for Result types and services.

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
| Unit tests | `*.test.ts` | `__tests__/` folder next to source |
| Integration tests | `*.integration.test.ts` | `__tests__/` folder |
| Mocks | `*.mock.ts` | `__mocks__/` folder next to source |

### Directory Structure

```
src/services/users/
├── UsersService.ts
├── __tests__/
│   └── UsersService.integration.test.ts
├── __mocks__/
│   └── UsersService.mock.ts
├── actions/
│   ├── createUser.ts
│   └── __tests__/
│       └── createUser.test.ts
└── repos/
    └── UsersRepo.ts
```

## Unit Testing

### Basic Test Structure

```typescript
import { describe, expect, it, beforeEach, jest } from 'bun:test';

describe('functionName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should do something specific', () => {
    expect.assertions(2);  // Always declare expected assertions

    // Arrange
    const input = 'test';

    // Act
    const result = functionName(input);

    // Assert
    expect(result).toBe('expected');
    expect(result).toBeDefined();
  });
});
```

### Testing Actions

Actions are pure functions, making them easy to test:

```typescript
// packages/backend/src/services/jwt/actions/__tests__/createClaim.test.ts

import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { createClaim } from '@backend/services/jwt/actions/createClaim';
import { UserId } from '@core/domain/user/user';
import { beforeEach, describe, expect, it, jest } from 'bun:test';

describe('createClaim', () => {
  // Setup mocks
  const mockLogger = getMockedLogger();
  const mockAppConfig = getMockedAppConfigurationService();

  const ctx = {
    logger: mockLogger,
    appConfig: () => mockAppConfig,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create JWT claim with userId and permissions', () => {
    // Declare expected assertions
    expect.assertions(4);

    // Arrange
    mockAppConfig.isLocal.mockReturnValueOnce(false);
    mockAppConfig.site = 'https://example.com';

    const request = {
      userId: UserId('user-123'),
      permissions: ['read:users'] as const,
    };

    // Act
    const result = createClaim(ctx, request);

    // Assert
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.sub).toBe(request.userId);
      expect(result.value.aud).toContain('read:users');
      expect(result.value.iss).toBe('https://example.com');
    }
  });

  it('should log debug message', () => {
    expect.assertions(2);

    mockAppConfig.isLocal.mockReturnValueOnce(false);

    const result = createClaim(ctx, {
      userId: UserId('user-123'),
      permissions: [],
    });

    expect(result.isOk()).toBe(true);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Created JWT claim',
      expect.objectContaining({ userId: 'user-123' }),
    );
  });
});
```

### Testing Result Types

Always check `isOk()` or `isErr()` before accessing values:

```typescript
it('should return ok result with valid data', () => {
  expect.assertions(3);

  const result = someFunction(validInput);

  expect(result.isOk()).toBe(true);
  expect(result.isErr()).toBe(false);
  
  if (result.isOk()) {
    expect(result.value).toBeDefined();
  }
});

it('should return error with invalid data', () => {
  expect.assertions(3);

  const result = someFunction(invalidInput);

  expect(result.isErr()).toBe(true);
  expect(result.isOk()).toBe(false);
  
  if (result.isErr()) {
    expect(result.error.message).toBe('Expected error message');
  }
});
```

### Testing Validation

```typescript
import { validUser } from '@core/domain/user/validation/validUser';
import { UserId } from '@core/domain/user/user';
import { describe, expect, it } from 'bun:test';

describe('validUser', () => {
  it('should validate correct user data', () => {
    expect.assertions(2);

    const input = {
      id: UserId(),
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: 1,
    };

    const result = validUser(input);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.email).toBe('test@example.com');
    }
  });

  it('should reject invalid email', () => {
    expect.assertions(2);

    const input = {
      id: UserId(),
      email: 'not-an-email',
      name: 'Test User',
      createdAt: new Date(),
      schemaVersion: 1,
    };

    const result = validUser(input);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Validation failed');
    }
  });
});
```

## Integration Testing

### Setup

Integration tests require real infrastructure (database, cache):

```typescript
import { createUsersService } from '@backend/services/users/UsersService';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { describe, expect, it } from 'bun:test';

describe('UsersService Integration Tests', () => {
  // Setup test infrastructure (database, cache)
  const { getConfig, getLogger } = setupIntegrationTest();

  const setup = () => {
    return createUsersService({
      appConfig: () => getConfig(),
      logger: getLogger(),
    });
  };

  describe('create()', () => {
    it('should create a user in database', async () => {
      expect.assertions(3);
      
      const service = setup();

      const result = await service.create({
        schemaVersion: 1,
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.isOk()).toBe(true);
      const user = result._unsafeUnwrap();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('test@example.com');
    });
  });

  describe('get()', () => {
    it('should retrieve created user', async () => {
      expect.assertions(2);
      
      const service = setup();

      // Create
      const createResult = await service.create({ schemaVersion: 1 });
      const created = createResult._unsafeUnwrap();

      // Get
      const getResult = await service.get(created.id);

      expect(getResult.isOk()).toBe(true);
      expect(getResult._unsafeUnwrap().id).toBe(created.id);
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

## Creating Mocks

### Type-Safe Mocks

Use `ExtractMockMethods<T>` for type-safe mocks:

```typescript
// __mocks__/Logger.mock.ts
import type { ILogger } from '@backend/logger/Logger';
import type { ExtractMockMethods } from '@core/types';
import { mock } from 'bun:test';

export function getMockedLogger(): ExtractMockMethods<ILogger> {
  return {
    debug: mock(),
    info: mock(),
    error: mock(),
  };
}
```

```typescript
// __mocks__/UsersService.mock.ts
import type { IUsersService } from '@backend/services/users/domain/UsersService';
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

### Using Mocks

```typescript
import { getMockedUsersService } from '@backend/services/users/__mocks__/UsersService.mock';
import { UserId } from '@core/domain/user/user';
import { ok } from 'neverthrow';

describe('MyHandler', () => {
  const mockUsersService = getMockedUsersService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call usersService.get', async () => {
    expect.assertions(2);

    const userId = UserId('test-id');
    const mockUser = { id: userId, /* ... */ };

    // Setup mock return value
    mockUsersService.get.mockResolvedValueOnce(ok(mockUser));

    // Act
    const result = await myHandler({ userId });

    // Assert
    expect(mockUsersService.get).toHaveBeenCalledWith(userId);
    expect(result.isOk()).toBe(true);
  });
});
```

## Test Best Practices

### 1. Use expect.assertions(n)

Always declare expected assertion count at the start:

```typescript
it('should do something', () => {
  expect.assertions(3);  // Ensures all paths tested

  const result = functionUnderTest();

  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toBe('expected');
    expect(result.value.length).toBeGreaterThan(0);
  }
});
```

### 2. Check Result Types

Always check `isOk()` or `isErr()` before accessing values:

```typescript
// ❌ BAD - might throw
const user = result.value;

// ✅ GOOD - type-safe
if (result.isOk()) {
  const user = result.value;
}

// ✅ ACCEPTABLE in tests when certain
const user = result._unsafeUnwrap();
```

### 3. Clear Mocks

Clear mocks in `beforeEach` to avoid test pollution:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### 4. Use Factory Functions

Use factory functions like `UserId()` to create test data:

```typescript
// ✅ GOOD
const userId = UserId();
const user = newUser({ id: userId, email: 'test@example.com' });

// ❌ BAD - hard-coded values
const userId = 'user-123';
const user = { id: 'user-123', /* ... */ };
```

### 5. Isolate Tests

Each test should be independent:

```typescript
// ❌ BAD - tests depend on each other
let sharedUser: User;

it('creates user', () => {
  sharedUser = createUser();  // State shared
});

it('updates user', () => {
  updateUser(sharedUser);  // Depends on previous test
});

// ✅ GOOD - tests are isolated
it('creates user', () => {
  const user = createUser();
  expect(user).toBeDefined();
});

it('updates user', () => {
  const user = createUser();  // Create fresh data
  const updated = updateUser(user);
  expect(updated).toBeDefined();
});
```

### 6. Name Tests Descriptively

Use clear, descriptive test names:

```typescript
// ❌ BAD
it('works', () => { /* ... */ });
it('test 1', () => { /* ... */ });

// ✅ GOOD
it('should return error when user not found', () => { /* ... */ });
it('should create user with valid email', () => { /* ... */ });
it('should reject password without uppercase letter', () => { /* ... */ });
```

## Testing Patterns

### Testing Async Code

```typescript
it('should handle async operations', async () => {
  expect.assertions(2);

  const result = await asyncFunction();

  expect(result.isOk()).toBe(true);
  if (result.isOk()) {
    expect(result.value).toBeDefined();
  }
});
```

### Testing Error Cases

```typescript
it('should return NotFoundError when user does not exist', async () => {
  expect.assertions(3);

  mockRepo.get.mockResolvedValueOnce(ok(null));

  const result = await usersService.get(UserId('non-existent'));

  expect(result.isErr()).toBe(true);
  if (result.isErr()) {
    expect(result.error.name).toBe('NotFoundError');
    expect(result.error.message).toContain('not found');
  }
});
```

### Testing Side Effects

```typescript
it('should log error message on failure', async () => {
  expect.assertions(2);

  const error = new Error('Database error');
  mockRepo.create.mockResolvedValueOnce(err(error));

  const result = await usersService.create(userData);

  expect(result.isErr()).toBe(true);
  expect(mockLogger.error).toHaveBeenCalledWith(
    expect.stringContaining('Failed'),
    error,
    expect.any(Object),
  );
});
```

### Testing Multiple Scenarios

```typescript
describe('calculateDiscount', () => {
  it.each([
    [100, 0, 100],
    [100, 10, 90],
    [100, 50, 50],
    [100, 100, 0],
  ])('should calculate %d - %d% = %d', (amount, discount, expected) => {
    expect.assertions(1);

    const result = calculateDiscount(amount, discount);

    expect(result).toBe(expected);
  });
});
```

## Test Coverage

### Running with Coverage

```bash
bun test --coverage
```

### Coverage Goals

- **Unit tests**: Aim for 80%+ coverage of business logic
- **Integration tests**: Cover critical paths and edge cases
- **Acceptance**: 100% coverage not always necessary - focus on important code

## Common Testing Scenarios

### Testing Services

```typescript
describe('UsersService', () => {
  const mockRepo = getMockedUsersRepo();
  const mockCache = getMockedUsersCache();
  const mockLogger = getMockedLogger();

  const createService = () => {
    return new UsersService({
      logger: mockLogger,
      repo: () => mockRepo,
      cache: () => mockCache,
    });
  };

  it('should get user from cache if available', async () => {
    expect.assertions(3);

    const userId = UserId();
    const cachedUser = newUser({ id: userId });

    mockCache.get.mockResolvedValueOnce(ok(cachedUser));

    const service = createService();
    const result = await service.get(userId);

    expect(result.isOk()).toBe(true);
    expect(mockCache.get).toHaveBeenCalledWith(userId);
    expect(mockRepo.get).not.toHaveBeenCalled();
  });
});
```

### Testing HTTP Handlers

```typescript
import { setupHttpIntegrationTest } from '@backend/testing/integration/httpIntegrationTest';

describe('GET /users/:id', () => {
  const { request, getServices } = setupHttpIntegrationTest();

  it('should return user by id', async () => {
    expect.assertions(3);

    const services = getServices();
    const createResult = await services.users().create({ schemaVersion: 1 });
    const user = createResult._unsafeUnwrap();

    const response = await request(`/users/${user.id}`, {
      method: 'GET',
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(user.id);
    expect(body.schemaVersion).toBe(1);
  });
});
```

## Debugging Tests

### Running Single Test

```bash
bun test path/to/file.test.ts
bun test --grep "test name pattern"
```

### Test Timeouts

```typescript
it('should complete within timeout', async () => {
  // Default timeout is usually 5s
  const result = await longRunningOperation();
  expect(result).toBeDefined();
}, 10000);  // 10 second timeout
```

### Debug Logging

```typescript
it('should process data', () => {
  const data = processData(input);
  console.log('Processed:', data);  // Allowed in tests
  expect(data).toBeDefined();
});
```

## Next Steps

- [Services Guide](./services.md) - Build testable services
- [Architecture Guide](./architecture.md) - Understand Result types
- [Domain Modeling Guide](./domain-modeling.md) - Test domain validation
- [Code Style Guide](./code-style.md) - Testing exceptions

## Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [neverthrow Documentation](https://github.com/supermacro/neverthrow)
