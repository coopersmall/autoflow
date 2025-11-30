# Code Style Guide

Autoflow enforces strict code quality and consistency through [Biome](https://biomejs.dev), a fast linter and formatter. This guide explains our coding standards and the patterns we enforce.

## Quick Reference

Before committing code, always run:

```bash
make lint    # Check for issues
make format  # Auto-fix formatting
make tsc     # Type check
```

## Biome Configuration

Our Biome configuration (`biome.json`) enforces:
- Consistent formatting (2 spaces, single quotes, trailing commas)
- TypeScript best practices
- Custom rules via Grit patterns

## Forbidden Patterns

The following patterns are **strictly prohibited** and will cause build failures:

### 1. No Throwing Errors

**Why**: Thrown errors bypass type checking and make error handling unpredictable. We use `Result` types for type-safe error handling.

```typescript
// ❌ BAD - throws are not allowed
function getUser(id: string): User {
  const user = users.get(id);
  if (!user) {
    throw new Error('User not found');  // Biome error!
  }
  return user;
}

// ✅ GOOD - use Result types
import { ok, err, type Result } from 'neverthrow';
import { NotFoundError } from '@core/errors/NotFoundError';

function getUser(id: string): Result<User, NotFoundError> {
  const user = users.get(id);
  if (!user) {
    return err(new NotFoundError('User not found'));
  }
  return ok(user);
}
```

**Enforcement**: Custom Grit pattern in `biome/no-throw.grit`

**Exception**: Throwing is only allowed in test files and truly exceptional cases that should crash the application (like initialization failures).

### 2. No `any` Type

**Why**: The `any` type disables TypeScript's type checking, defeating the purpose of using TypeScript.

```typescript
// ❌ BAD
function process(data: any) {
  return data.value;  // No type safety!
}

// ✅ GOOD - use unknown for truly unknown types
function process(data: unknown) {
  // Must validate before use
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return data.value;
  }
  return undefined;
}

// ✅ GOOD - use Record for key-value objects
function process(data: Record<string, unknown>) {
  return data.value;
}

// ✅ GOOD - use generics for reusable code
function process<T>(data: T) {
  return data;
}
```

**Enforcement**: Biome rule `noExplicitAny: "error"`

**Exception**: Allowed in test files and mocks where type safety is less critical.

### 3. No Type Assertions

**Why**: Type assertions (`as` or `<Type>`) bypass TypeScript's type checking and can hide bugs. Use validation instead.

```typescript
// ❌ BAD
const user = data as User;           // Biome error!
const user = <User>data;             // Biome error!

// ✅ GOOD - use validation with Result types
import { validUser } from '@core/domain/user/validation/validUser';

const result = validUser(data);
if (result.isErr()) {
  return err(result.error);
}
const user = result.value;  // Type-safe!
```

**Enforcement**: Custom Grit pattern in `biome/no-type-assertion.grit`

**When validation isn't available**: Create a validation function rather than using assertions.

### 4. No `console.log`

**Why**: Console logs bypass our logging infrastructure, making debugging and monitoring difficult in production.

```typescript
// ❌ BAD
console.log('Debug info');           // Biome error!
console.error('Error occurred');     // Biome error!

// ✅ GOOD - use the logger
import type { ILogger } from '@backend/logger/Logger';

function myFunction(ctx: { logger: ILogger }) {
  ctx.logger.debug('Debug info', { context: 'additional data' });
  ctx.logger.info('User created', { userId: '123' });
  ctx.logger.error('Operation failed', error, { context: 'more info' });
}
```

**Enforcement**: Biome rule `noConsole: "error"`

**Logger levels**:
- `debug()` - Development debugging
- `info()` - Important events
- `error()` - Errors with context

### 5. No Direct `process.env` Access

**Why**: Direct environment variable access scatters configuration throughout the codebase and makes testing difficult.

```typescript
// ❌ BAD
const apiKey = process.env.API_KEY;     // Biome error!
const port = process.env.PORT || 3000;  // Biome error!

// ✅ GOOD - use AppConfigurationService
import { createAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';

const appConfig = createAppConfigurationService();
const apiKey = appConfig.apiKey;
const port = appConfig.port;
```

**Enforcement**: Custom Grit pattern in `biome/no-process-env.grit`

**Exception**: Only allowed in `AppConfigurationService` itself and initialization files.

### 6. No Relative Imports Going Up

**Why**: Relative imports like `../../../` are fragile and difficult to refactor. Use path aliases instead.

```typescript
// ❌ BAD
import { User } from '../../../domain/user';              // Biome error!
import { createUsersService } from '../../services/users'; // Biome error!

// ✅ GOOD - use path aliases
import { User } from '@core/domain/user/user';
import { createUsersService } from '@backend/services/users/UsersService';
```

**Enforcement**: Biome rule `noRestrictedImports`

### 7. Prefer Functional Array Methods

**Why**: Functional methods like `map`, `filter`, `find`, `forEach`, and `flatMap` are more declarative and easier to read than imperative for loops.

```typescript
// ❌ BAD - imperative for loop for simple iteration
for (const item of items) {
  process(item);
}

// ✅ GOOD - forEach for side effects
items.forEach(item => process(item));

// ❌ BAD - for loop to find an element
for (const env of environments) {
  if (env === target) {
    return env;
  }
}

// ✅ GOOD - find for searching
return environments.find(env => env === target);

// ❌ BAD - nested for loops
for (const handler of handlers) {
  for (const route of handler.routes()) {
    addRoute(route);
  }
}

// ✅ GOOD - flatMap + forEach
handlers.flatMap(h => h.routes()).forEach(route => addRoute(route));
```

**When to keep for loops**: Use imperative for loops when you need:
- Early return on error (fail-fast validation patterns)
- Index manipulation (`i++` to skip elements)
- Generator yields (`yield` inside the loop)
- Complex control flow (retry logic, break/continue)

**Enforcement**: Not enforced by Biome, but encouraged in code reviews.

### 8. Use Readonly Types and Object.freeze

**Why**: Immutability prevents accidental mutations, makes code more predictable, and aligns with functional programming principles.

#### Readonly Types for Domain Models

Use `Readonly<T>` wrapper for all domain types derived from Zod schemas:

```typescript
// ❌ BAD - mutable type
export type User = zod.infer<typeof userSchema>;

// ✅ GOOD - immutable type
export type User = Readonly<zod.infer<typeof userSchema>>;
```

#### Readonly Types for Service Interfaces

Use `Readonly<T>` for service interface types:

```typescript
// ✅ GOOD - prevents accidental method replacement
export type IUsersService = Readonly<UsersService>;
export type IAppConfigurationService = Readonly<ExtractMethods<AppConfigurationService>>;
```

#### Object.freeze for Factory Functions

Use `Object.freeze()` when returning service instances from factory functions:

```typescript
// ❌ BAD - mutable instance
export function createUsersService(ctx: UsersServiceContext): IUsersService {
  return new UsersService(ctx);
}

// ✅ GOOD - frozen instance
export function createUsersService(ctx: UsersServiceContext): IUsersService {
  return Object.freeze(new UsersService(ctx));
}
```

**When to use**:
- `Readonly<T>`: All domain types, service interfaces, and data transfer objects
- `Object.freeze()`: All factory functions returning service instances

**Enforcement**: Not enforced by Biome, but encouraged in code reviews.

## Path Aliases

Use these path aliases for imports:

| Alias | Maps To | Usage |
|-------|---------|-------|
| `@core/*` | `packages/core/src/*` | Domain models, types, validation |
| `@backend/*` | `packages/backend/src/*` | Services, repos, handlers |
| `@client/*` | `packages/client/src/*` | HTTP client code |
| `@web/*` | `packages/web/src/*` | Web UI components |
| `@autoflow/core` | `packages/core/src` | Core package root |
| `@autoflow/backend` | `packages/backend/src` | Backend package root |
| `@autoflow/client` | `packages/client/src` | Client package root |
| `@autoflow/web` | `packages/web/src` | Web package root |

**Examples**:

```typescript
// Domain types from core
import { User, UserId } from '@core/domain/user/user';
import { Secret } from '@core/domain/secrets/Secret';
import { validate } from '@core/validation/validate';

// Services from backend
import { createUsersService } from '@backend/services/users/UsersService';
import { createSecretsService } from '@backend/services/secrets/SecretsService';
import type { ILogger } from '@backend/logger/Logger';

// Client utilities
import { createHttpClient } from '@client/http-client/httpClient';

// Web components
import { DefaultLayout } from '@web/components/layout/DefaultLayout';
```

## Formatting Rules

Biome automatically formats code with these rules:

- **Indentation**: 2 spaces
- **Line width**: 80 characters
- **Quotes**: Single quotes for JS/TS, double quotes for JSX
- **Semicolons**: Always
- **Trailing commas**: Always
- **Arrow function parens**: Always
- **Line endings**: LF (Unix style)

**Auto-format on save**: See [Setup Guide](./setup.md#ide-setup) for editor configuration.

## TypeScript Best Practices

### Use Proper Types

```typescript
// ❌ Avoid primitive wrapper types
const name: String = 'John';  // Biome error!

// ✅ Use primitive types
const name: string = 'John';

// ❌ Avoid Function type
const handler: Function = () => {};  // Biome error!

// ✅ Use specific function signatures
const handler: (id: string) => Promise<void> = async (id) => {};

// ❌ Avoid empty object type
const data: {} = { name: 'John' };  // Biome error!

// ✅ Use Record or object
const data: Record<string, unknown> = { name: 'John' };
const data: object = { name: 'John' };
```

### Prefer const over let

```typescript
// ❌ BAD
let count = 0;  // Never reassigned

// ✅ GOOD
const count = 0;
```

### Use const assertions

```typescript
// ❌ BAD
const config = {
  mode: 'production',
  version: 1,
};
// Type: { mode: string, version: number }

// ✅ GOOD
const config = {
  mode: 'production',
  version: 1,
} as const;
// Type: { readonly mode: 'production', readonly version: 1 }
```

## Import Organization

Biome automatically organizes imports:

```typescript
// 1. External dependencies
import { ok, err } from 'neverthrow';
import zod from 'zod';

// 2. Internal aliases (alphabetical by alias)
import type { ILogger } from '@backend/logger/Logger';
import { createUsersService } from '@backend/services/users/UsersService';
import { User, UserId } from '@core/domain/user/user';
import { validate } from '@core/validation/validate';

// 3. Relative imports (if needed in same directory)
import { helperFunction } from './helpers';
```

**Enable in your editor**: See [Setup Guide](./setup.md#ide-setup)

## Naming Conventions

While not enforced by Biome, follow these conventions:

- **Files**: PascalCase for classes/components, camelCase for utilities
  - `UsersService.ts`, `user.ts`, `validUser.ts`
  
- **Types/Interfaces**: PascalCase with `I` prefix for interfaces
  - `type User`, `interface IUsersService`
  
- **Functions**: camelCase
  - `createUsersService()`, `validUser()`
  
- **Constants**: UPPER_SNAKE_CASE for true constants
  - `DEFAULT_TIMEOUT`, `MAX_RETRIES`
  
- **Factory functions**: Prefix with `create` or `new`
  - `createUsersService()`, `UserId()` (for ID generation)

## Testing Exceptions

Test files have relaxed rules:

```typescript
// In **/*.test.ts, **/__tests__/**/*.ts, **/__mocks__/**/*.ts
describe('MyService', () => {
  const mockData: any = { /* ... */ };  // ✅ Allowed in tests
  
  it('should handle data', () => {
    expect(result!.value).toBe(123);  // ✅ Non-null assertion OK
  });
});
```

**Allowed in tests**:
- `any` type
- Non-null assertions (`!`)
- Empty blocks

## Pre-commit Workflow

Before committing:

```bash
# 1. Format code
make format

# 2. Check for lint errors
make lint

# 3. Type check
make tsc

# 4. Run tests
make test
```

**Set up a pre-commit hook** (optional):

```bash
# .git/hooks/pre-commit
#!/bin/sh
make lint && make tsc
```

## Unsafe Fixes

Some formatting requires unsafe fixes:

```bash
# Use with caution - reviews automated changes
make format-unsafe
```

**When to use**: Biome suggests unsafe fixes for imports and some transformations. Review carefully before committing.

## Common Violations & Fixes

### Mixing throw and Result

```typescript
// ❌ Inconsistent error handling
async function getUser(id: UserId): Promise<Result<User, Error>> {
  if (!id) {
    throw new Error('Invalid ID');  // Don't mix!
  }
  return fetchUser(id);
}

// ✅ Consistent Result usage
async function getUser(id: UserId): Promise<Result<User, ErrorWithMetadata>> {
  if (!id) {
    return err(new ErrorWithMetadata('Invalid ID', 'BadRequest'));
  }
  return fetchUser(id);
}
```

### Forgetting logger context

```typescript
// ❌ Missing context
logger.error('Failed to create user', error);

// ✅ Include context
logger.error('Failed to create user', error, {
  userId,
  correlationId,
  attemptNumber: 1,
});
```

## Additional Resources

- [Biome Documentation](https://biomejs.dev)
- [neverthrow Documentation](https://github.com/supermacro/neverthrow)
- [Architecture Guide](./architecture.md) - Learn about Result types
- [Testing Guide](./testing.md) - Testing with Result types

## Summary

Key rules:
1. ✅ Use `Result` types, ❌ no throwing errors
2. ✅ Use `unknown`/generics, ❌ no `any`
3. ✅ Use validation, ❌ no type assertions
4. ✅ Use `logger`, ❌ no `console.log`
5. ✅ Use `AppConfigurationService`, ❌ no `process.env`
6. ✅ Use path aliases, ❌ no relative imports up
7. ✅ Use functional array methods (map, filter, find, forEach), ❌ avoid for loops when not needed
8. ✅ Use `Readonly<T>` and `Object.freeze()` for immutability

Run `make lint` and `make format` before every commit!
