# @autoflow/core

Shared domain types, error classes, and validation utilities. This package has zero runtime dependencies (except Zod for validation) and serves as the foundation for all other packages.

## Purpose

The core package provides:

1. **Domain entities** - Type definitions for business objects
2. **Error types** - Standardized error hierarchy
3. **Validation** - Zod-based validation utilities
4. **Type utilities** - Helper types for testing and interfaces

By centralizing these in a separate package, we:
- Prevent circular dependencies between packages
- Enforce clear domain boundaries
- Enable consistent type definitions across frontend and backend

## Domain Entities

### Base Types

```typescript
// Branded ID type - prevents mixing different ID types
type UserId = Id<'user'>;
type SecretId = Id<'secret'>;

// Base entity with standard fields
interface Item<ID> {
  id: ID;
  createdAt: Date;
  updatedAt: Date;
}
```

### Available Domains

| Domain | Description |
|--------|-------------|
| `user/` | User entity and validation |
| `permissions/` | Permission system types |
| `jwt/` | JWT claim structures |
| `session/` | User session types |
| `secrets/` | Encrypted secrets handling |
| `integrations/` | External service integrations (AI providers, HTTP, Polygon) |
| `streaming/` | Stream chunk types for real-time data |
| `ai/` | AI model and response types |
| `markets/`, `stocks/`, `options/` | Financial data types |

## Error Types

All errors extend `ErrorWithMetadata` which provides:
- Error code for programmatic handling
- Metadata object for context
- Stack trace preservation

```typescript
// Base error with metadata
class ErrorWithMetadata extends Error {
  code: ErrorCode;
  metadata: Record<string, unknown>;
}

// Specific error types
class ValidationError extends ErrorWithMetadata { }
class NotFoundError extends ErrorWithMetadata { }
class UnauthorizedError extends ErrorWithMetadata { }
class TimeoutError extends ErrorWithMetadata { }
class HttpRequestError extends ErrorWithMetadata { }
```

### Error Codes

```typescript
type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'TIMEOUT'
  | 'HTTP_REQUEST_ERROR'
  | 'INTERNAL_ERROR';
```

## Validation

Validation functions wrap Zod schemas and return `Result` types:

```typescript
import { validate } from '@autoflow/core';
import { userSchema } from '@autoflow/core';

const result = validate(userSchema, data);
if (result.isErr()) {
  // result.error is a ValidationError
  console.error(result.error.message);
} else {
  // result.value is typed as User
  const user = result.value;
}
```

### Validation Helpers

```typescript
// Validate an ID
const idResult = validId(rawId);

// Validate a complete Item
const itemResult = validItem(schema, data);

// Domain-specific validators
const userResult = validUser(data);
const secretResult = validSecret(data);
```

## Type Utilities

Helper types for extracting interfaces and creating mocks:

```typescript
import type { ExtractMethods, ExtractMockMethods, MethodKeys } from '@autoflow/core';

// Extract public methods from a class for interfaces
type IUserService = ExtractMethods<UserService>;

// Create mock type with all methods as Bun test mocks
type MockUserService = ExtractMockMethods<UserService>;

// Get just the method names
type UserServiceMethods = MethodKeys<UserService>;
```

### Why ExtractMethods?

Instead of manually maintaining interfaces:

```typescript
// Manual approach - error prone, gets out of sync
interface IUserService {
  get(id: UserId): Promise<Result<User, Error>>;
  create(data: CreateUserData): Promise<Result<User, Error>>;
  // ... must update when class changes
}
```

We automatically extract the interface:

```typescript
// Automatic - always in sync
type IUserService = ExtractMethods<UserService>;
```

## Usage

```typescript
import {
  // Domain types
  type User,
  type UserId,
  UserId, // factory function
  
  // Errors
  ValidationError,
  NotFoundError,
  
  // Validation
  validate,
  validUser,
  
  // Utilities
  type ExtractMethods,
  unreachable,
} from '@autoflow/core';
```

## Directory Structure

```
src/
├── domain/               # Business entity definitions
│   ├── Id.ts             # Branded ID type
│   ├── Item.ts           # Base entity type
│   ├── user/             # User domain
│   ├── permissions/      # Permissions
│   ├── jwt/              # JWT claims
│   ├── secrets/          # Secrets
│   ├── integrations/     # External integrations
│   └── ...
│
├── errors/               # Error class hierarchy
│   ├── ErrorWithMetadata.ts
│   ├── ValidationError.ts
│   ├── NotFoundError.ts
│   └── ...
│
├── validation/           # Validation utilities
│   └── validate.ts
│
├── types.ts              # Type utilities (ExtractMethods, etc.)
├── unreachable.ts        # Exhaustiveness checking helper
└── index.ts              # Public exports
```

## Design Principles

1. **No runtime dependencies** - Only Zod for validation
2. **Type-first** - Types drive the implementation
3. **Validation at boundaries** - All external data is validated
4. **Branded types** - IDs are branded to prevent mixing
5. **Result types** - Validation returns Result, not throws
