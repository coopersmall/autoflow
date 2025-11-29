# Domain Modeling Guide

This guide explains how to model domain objects in Autoflow using Zod schemas, branded types, and versioned schemas for evolution.

## Overview

Domain models in Autoflow:
- Live in `packages/core/src/domain/`
- Use [Zod](https://zod.dev) for schema definition and validation
- Employ branded types for type-safe IDs
- Support schema versioning for backward compatibility
- Follow functional validation patterns

## Basic Domain Object

### Step 1: Define Branded ID Type

```typescript
// packages/core/src/domain/user/user.ts

import { newId } from '@core/domain/Id';
import zod from 'zod';

export type UserId = zod.infer<typeof userIdSchema>;
export const UserId = newId<UserId>;

export const userIdSchema = zod
  .string()
  .brand<'UserId'>()
  .describe('the id of a user');
```

**Why branded types?**
- Prevents accidentally mixing different ID types
- `UserId` and `SecretId` are incompatible even though both are strings
- Compile-time safety

```typescript
// This won't compile - type safety!
function getSecret(id: SecretId) { /* ... */ }
const userId: UserId = UserId('user-123');
getSecret(userId);  // ❌ Type error!
```

### Step 2: Define Base Schema

Use `createItemSchema()` to include standard fields:

```typescript
import { createItemSchema } from '@core/domain/Item';

const baseUserSchema = createItemSchema(userIdSchema).extend({
  email: zod.string().email().describe('the user email address'),
  name: zod.string().min(1).describe('the user name'),
  role: zod.enum(['admin', 'user']).describe('the user role'),
});
```

**Standard Item fields** (from `createItemSchema`):
- `id`: Branded ID
- `createdAt`: Date (creation timestamp)
- `updatedAt`: Date (optional, last update timestamp)
- `schemaVersion`: number (for schema evolution)

### Step 3: Add Version Discriminator

```typescript
const userV1Schema = baseUserSchema.extend({
  schemaVersion: zod.literal(1),
});
```

### Step 4: Create Discriminated Union

```typescript
export const userSchema = zod.discriminatedUnion('schemaVersion', [
  userV1Schema,
  // Future versions go here: userV2Schema, userV3Schema, etc.
]);

export type User = zod.infer<typeof userSchema>;
```

### Step 5: Create Validation Function

```typescript
import { validate } from '@core/validation/validate';
import type { ValidationError } from '@core/errors/ValidationError';
import type { Result } from 'neverthrow';

export function validUser(input: unknown): Result<User, ValidationError> {
  return validate(userSchema, input);
}
```

## Complete Example: User Domain

```typescript
// packages/core/src/domain/user/user.ts

import { newId } from '@core/domain/Id';
import { createItemSchema } from '@core/domain/Item';
import zod from 'zod';

// 1. Branded ID type
export type UserId = zod.infer<typeof userIdSchema>;
export const UserId = newId<UserId>;

export const userIdSchema = zod
  .string()
  .brand<'UserId'>()
  .describe('the id of a user');

// 2. Base schema with domain fields
const baseUserSchema = createItemSchema(userIdSchema).extend({
  email: zod.string().email().describe('the user email address'),
  name: zod.string().min(1).describe('the user name'),
});

// 3. Version 1 schema
const userV1Schema = baseUserSchema.extend({
  schemaVersion: zod.literal(1),
});

// 4. Discriminated union
export const userSchema = zod.discriminatedUnion('schemaVersion', [
  userV1Schema,
]);

export type User = zod.infer<typeof userSchema>;

// 5. Partial schema (for creation - omit generated fields)
const partialUserV1Schema = userV1Schema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const partialUserSchema = zod.discriminatedUnion('schemaVersion', [
  partialUserV1Schema,
]);

export type PartialUser = zod.infer<typeof partialUserSchema>;

// 6. Update schema (all fields optional except id)
const updateUserV1Schema = userV1Schema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();

export const updateUserSchema = zod.discriminatedUnion('schemaVersion', [
  updateUserV1Schema,
]);

export type UpdateUser = zod.infer<typeof updateUserSchema>;

// 7. Factory function for tests
export function newUser(overrides?: Partial<User>): User {
  return {
    id: UserId(),
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
    ...overrides,
  };
}
```

## Validation Pattern

### Validation Function

```typescript
// packages/core/src/domain/user/validation/validUser.ts

import { validate } from '@core/validation/validate';
import { userSchema, type User } from '@core/domain/user/user';
import type { ValidationError } from '@core/errors/ValidationError';
import type { Result } from 'neverthrow';

export function validUser(input: unknown): Result<User, ValidationError> {
  return validate(userSchema, input);
}
```

### Using Validation

```typescript
import { validUser } from '@core/domain/user/validation/validUser';

const result = validUser(unknownData);

if (result.isErr()) {
  logger.error('Validation failed', result.error);
  return err(result.error);
}

const user = result.value;  // Type-safe User object
```

## Schema Versioning

### Why Version Schemas?

- **Backward Compatibility**: Old data still works
- **Safe Evolution**: Add fields without breaking existing data
- **Migration Path**: Clear upgrade path for data

### Adding a New Version

```typescript
// Version 1
const userV1Schema = baseUserSchema.extend({
  schemaVersion: zod.literal(1),
});

// Version 2 - add new required field
const userV2Schema = baseUserSchema.extend({
  schemaVersion: zod.literal(2),
  phoneNumber: zod.string().optional(),  // Start optional
  preferences: zod.object({
    theme: zod.enum(['light', 'dark']),
  }),
});

// Union of all versions
export const userSchema = zod.discriminatedUnion('schemaVersion', [
  userV1Schema,
  userV2Schema,
]);

export type User = zod.infer<typeof userSchema>;
```

### Handling Multiple Versions

```typescript
function processUser(user: User) {
  // TypeScript knows which fields exist based on schemaVersion
  if (user.schemaVersion === 1) {
    // user is UserV1
    logger.info('V1 user', { email: user.email });
  } else if (user.schemaVersion === 2) {
    // user is UserV2
    logger.info('V2 user', {
      email: user.email,
      theme: user.preferences.theme,  // Only available in V2
    });
  }
}
```

## Advanced Patterns

### Nested Domain Objects

```typescript
// Define metadata schema
export const secretMetadataSchema = zod.strictObject({
  createdBy: userIdSchema
    .optional()
    .describe('the user who created the secret'),
  lastEditedBy: userIdSchema
    .optional()
    .describe('the user who last edited the secret'),
  lastEditedAt: zod
    .date()
    .optional()
    .describe('the date when the secret was last edited'),
});

// Use in parent schema
const baseSecretSchema = createItemSchema(secretIdSchema).extend({
  name: zod.string().min(1).describe('the name of the secret'),
  metadata: secretMetadataSchema.describe('the metadata of the secret'),
});
```

### Discriminated Unions by Type

```typescript
// Different secret types
const storedSecretV1Schema = baseSecretSchema.extend({
  type: zod.literal('stored'),
  schemaVersion: zod.literal(1),
  encryptedValue: zod.string().min(1),
  salt: zod.string().min(1),
});

const referenceSecretV1Schema = baseSecretSchema.extend({
  type: zod.literal('reference'),
  schemaVersion: zod.literal(1),
  referenceId: zod.string().min(1),
});

export const secretSchema = zod.discriminatedUnion('type', [
  storedSecretV1Schema,
  referenceSecretV1Schema,
]);

export type Secret = zod.infer<typeof secretSchema>;

// Type guards
export function isStoredSecret(
  secret: Secret
): secret is StoredSecret {
  return secret.type === 'stored';
}

export function isReferenceSecret(
  secret: Secret
): secret is ReferenceSecret {
  return secret.type === 'reference';
}
```

### Enum Types

```typescript
// Define as const array
export const secretTypes = ['stored', 'reference'] as const;

// Derive type
export type SecretType = (typeof secretTypes)[number];

// Use in schema
const baseSecretSchema = createItemSchema(secretIdSchema).extend({
  type: zod.enum(secretTypes).describe('the type of the secret'),
});
```

### Extending Types

```typescript
export type Secret = zod.infer<typeof secretSchema>;
export type SecretWithValue = Secret & { value: string };

function decryptSecret(secret: Secret): SecretWithValue {
  const value = decrypt(secret.encryptedValue);
  return { ...secret, value };
}
```

## ID Generation

### Using newId

```typescript
import { newId } from '@core/domain/Id';

export type UserId = zod.infer<typeof userIdSchema>;
export const UserId = newId<UserId>;

// Generate new IDs
const id1 = UserId();  // e.g., "usr_1a2b3c4d"
const id2 = UserId();  // e.g., "usr_5e6f7g8h"

// IDs are unique
id1 !== id2  // true
```

### Custom ID Prefixes

```typescript
// UserId generates IDs like: "usr_..."
// SecretId generates IDs like: "sec_..."
// Each type has a different prefix for debugging
```

## File Organization

```
domain/
├── user/
│   ├── user.ts                 # Domain model
│   └── validation/
│       └── validUser.ts        # Validation function
├── secrets/
│   ├── Secret.ts               # Domain model
│   └── validation/
│       └── validSecret.ts      # Validation function
├── Id.ts                       # ID utilities
└── Item.ts                     # Base Item schema
```

## Testing Domain Models

```typescript
import { describe, expect, it } from 'bun:test';
import { validUser } from '@core/domain/user/validation/validUser';
import { UserId } from '@core/domain/user/user';

describe('validUser', () => {
  it('should validate correct user data', () => {
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

## Common Patterns

### Optional Fields

```typescript
const userSchema = baseUserSchema.extend({
  phoneNumber: zod.string().optional(),
  avatar: zod.string().url().optional(),
});
```

### Default Values

```typescript
const userSchema = baseUserSchema.extend({
  role: zod.enum(['admin', 'user']).default('user'),
  isActive: zod.boolean().default(true),
});
```

### Transformations

```typescript
const userSchema = baseUserSchema.extend({
  email: zod.string().email().transform(email => email.toLowerCase()),
  createdAt: zod.coerce.date(),  // Coerce string to Date
});
```

### Refinements

```typescript
const userSchema = baseUserSchema.extend({
  password: zod
    .string()
    .min(8)
    .refine(
      (pwd) => /[A-Z]/.test(pwd),
      'Password must contain uppercase letter'
    ),
});
```

## Best Practices

1. **Always use branded types for IDs** - Type safety prevents bugs
2. **Version your schemas** - Plan for evolution from day one
3. **Use descriptive descriptions** - Helps with documentation and errors
4. **Create partial/update schemas** - Different needs for create vs update
5. **Write validation functions** - Centralize validation logic
6. **Add type guards** - Make discriminated unions easier to use
7. **Test validation** - Ensure schemas work as expected

## Real-World Example: Secret Domain

```typescript
// packages/core/src/domain/secrets/Secret.ts

import { newId } from '@core/domain/Id';
import { createItemSchema } from '@core/domain/Item';
import { userIdSchema } from '@core/domain/user/user';
import zod from 'zod';

export type SecretId = zod.infer<typeof secretIdSchema>;
export const SecretId = newId<SecretId>;
export type SecretType = (typeof secretTypes)[number];
export type Secret = zod.infer<typeof secretSchema>;

export const secretIdSchema = zod
  .string()
  .brand<'SecretId'>()
  .describe('the id of a secret');

export const secretTypes = ['stored'] as const;

export const secretMetadataSchema = zod.strictObject({
  createdBy: userIdSchema.optional(),
  lastEditedBy: userIdSchema.optional(),
  lastEditedAt: zod.date().optional(),
});

const baseSecretSchema = createItemSchema(secretIdSchema).extend({
  type: zod.enum(secretTypes),
  name: zod.string().min(1),
  metadata: secretMetadataSchema,
});

const storedSecretV1Schema = baseSecretSchema.extend({
  type: zod.literal('stored'),
  schemaVersion: zod.literal(1),
  salt: zod.string().min(1),
  encryptedValue: zod.string().min(1),
});

export const secretSchema = zod.discriminatedUnion('type', [
  storedSecretV1Schema,
]);
```

## Next Steps

- [Services Guide](./services.md) - Use domain models in services
- [Testing Guide](./testing.md) - Test domain validation
- [Architecture Guide](./architecture.md) - Understand Result types
- [Code Style Guide](./code-style.md) - Validation best practices

## Resources

- [Zod Documentation](https://zod.dev)
- [TypeScript Handbook: Branded Types](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)
