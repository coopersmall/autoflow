# Architecture Guide

Autoflow follows functional programming patterns with strong type safety. This guide explains the core architectural patterns used throughout the codebase.

## Core Principles

1. **Type Safety First**: Leverage TypeScript's type system to catch errors at compile time
2. **Functional Error Handling**: Use `Result` types instead of throwing exceptions
3. **Dependency Injection**: Pass dependencies via context objects
4. **Pure Business Logic**: Separate pure logic (actions) from side effects (services)
5. **Immutability**: Prefer immutable data structures

## Result Types

### Why Result Types?

Traditional error handling with `try/catch` has problems:
- Errors bypass the type system
- No compile-time guarantee that errors are handled
- Difficult to track which functions can fail

We use the **Result pattern** from [neverthrow](https://github.com/supermacro/neverthrow):

```typescript
import { ok, err, type Result } from 'neverthrow';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';

// Function signature shows it can fail
async function createUser(
  data: CreateUserData
): Promise<Result<User, ErrorWithMetadata>> {
  // ...
}
```

### Basic Usage

```typescript
import { ok, err, type Result } from 'neverthrow';
import { NotFoundError } from '@core/errors/NotFoundError';

// Creating Results
function getUser(id: UserId): Result<User, NotFoundError> {
  const user = users.get(id);
  
  if (!user) {
    return err(new NotFoundError('User not found'));
  }
  
  return ok(user);
}

// Checking Results
const result = getUser(userId);

if (result.isErr()) {
  logger.error('Failed to get user', result.error);
  return;
}

const user = result.value;  // Type-safe access
```

### Chaining Results

```typescript
import { ok, err, type Result } from 'neverthrow';

async function createUserWithSecret(
  userData: CreateUserData,
  secretData: CreateSecretData,
): Promise<Result<{ user: User; secret: Secret }, ErrorWithMetadata>> {
  // Validation
  const validationResult = validPartialUser(userData);
  if (validationResult.isErr()) {
    return err(validationResult.error);
  }

  // Create user
  const userResult = await usersRepo.create(validationResult.value);
  if (userResult.isErr()) {
    return err(userResult.error);
  }

  // Create secret
  const secretResult = await secretsRepo.create(
    userResult.value.id,
    secretData,
  );
  if (secretResult.isErr()) {
    // Rollback user creation would happen here
    return err(secretResult.error);
  }

  return ok({
    user: userResult.value,
    secret: secretResult.value,
  });
}
```

### Using _unsafeUnwrap

```typescript
// In tests or when you're certain of success
const user = result._unsafeUnwrap();  // Throws if error

// Better: always check first
if (result.isOk()) {
  const user = result.value;  // Type-safe
}
```

## Factory Functions

### Pattern

Instead of using `new` directly, use factory functions:

```typescript
// ❌ BAD - tight coupling, hard to test
const service = new UsersService(config, logger, repo, cache);

// ✅ GOOD - factory function with dependency injection
const service = createUsersService({
  appConfig: () => config,
  logger,
});
```

### Benefits

- **Testability**: Easy to mock dependencies
- **Flexibility**: Implementation details hidden
- **Consistency**: Standard pattern across codebase

### Example

```typescript
// packages/backend/src/users/UsersService.ts

export function createUsersService(
  ctx: UsersServiceContext
): IUsersService {
  return Object.freeze(new UsersService(ctx));
}

interface UsersServiceContext {
  readonly appConfig: IAppConfigurationService;
  readonly logger: ILogger;
}

interface UsersServiceDependencies {
  readonly createUsersRepo: typeof createUsersRepo;
  readonly createUsersCache: typeof createUsersCache;
}

class UsersService extends SharedService<UserId, User>
  implements IUsersService {
  
  constructor(
    private readonly context: UsersServiceContext,
    private readonly dependencies: UsersServiceDependencies = {
      createUsersRepo,
      createUsersCache,
    },
  ) {
    super('users', {
      ...context,
      repo: () => this.dependencies.createUsersRepo({ 
        appConfig: context.appConfig 
      }),
      cache: () => this.dependencies.createUsersCache({
        logger: context.logger,
        appConfig: context.appConfig,
      }),
      newId: UserId,
    });
  }
}
```

## Context Objects

### Pattern

Services and functions receive dependencies via context objects:

```typescript
interface CreateClaimContext {
  readonly logger: ILogger;
  readonly appConfig: IAppConfigurationService;
}

function createClaim(
  ctx: CreateClaimContext,
  request: CreateClaimRequest,
): Result<JWTClaim, ErrorWithMetadata> {
  ctx.logger.debug('Creating JWT claim', { userId: request.userId });
  // ...
}
```

### Benefits

- **Explicit Dependencies**: Clear what each function needs
- **Easy Testing**: Pass mock context in tests
- **Flexibility**: Add dependencies without changing signatures
- **Type Safety**: TypeScript ensures all dependencies provided

### Example from codebase

```typescript
// packages/backend/src/auth/actions/claims/createClaim.ts

export interface CreateClaimContext {
  readonly logger: ILogger;
  readonly appConfig: IAppConfigurationService;
}

export interface CreateClaimRequest {
  readonly correlationId?: CorrelationId;
  readonly userId: UserId;
  readonly permissions: Permission[];
  readonly expirationTime?: number;
}

export function createClaim(
  ctx: CreateClaimContext,
  request: CreateClaimRequest,
): Result<JWTClaim, ErrorWithMetadata> {
  const local = ctx.appConfig.isLocal();
  
  ctx.logger.debug('Created JWT claim', {
    correlationId: request.correlationId,
    userId: request.userId,
  });
  
  return ok({
    sub: request.userId,
    iss: ctx.appConfig.site,
    // ...
  });
}
```

## Action Pattern

### Philosophy

Business logic should be:
- **Pure**: No side effects except logging
- **Testable**: Easy to test in isolation
- **Reusable**: Can be called from services, handlers, or other actions

### Structure

```typescript
// actions/createClaim.ts

// 1. Define context interface
export interface CreateClaimContext {
  readonly logger: ILogger;
  readonly appConfig: IAppConfigurationService;
}

// 2. Define request interface
export interface CreateClaimRequest {
  readonly userId: UserId;
  readonly permissions: Permission[];
}

// 3. Implement pure function
export function createClaim(
  ctx: CreateClaimContext,
  request: CreateClaimRequest,
): Result<JWTClaim, ErrorWithMetadata> {
  // Pure business logic here
  const claim = {
    sub: request.userId,
    aud: request.permissions,
    // ...
  };
  
  ctx.logger.debug('Created claim', { userId: request.userId });
  
  return ok(claim);
}
```

### Actions vs Services

| Actions | Services |
|---------|----------|
| Pure functions | Classes with state |
| No I/O (except logging) | Perform I/O (database, cache, HTTP) |
| Easy to test | Require integration tests |
| Reusable | Orchestrate actions |
| Live in `actions/` folder | Live in service root |

## Service Patterns

### SharedService vs StandardService

Two base patterns for different data scoping:

#### SharedService - Global Data

Use for data that isn't owned by a specific user:

```typescript
// packages/backend/src/services/users/UsersService.ts

class UsersService extends SharedService<UserId, User> {
  // No userId parameter needed
  async get(id: UserId): Promise<Result<User, Error>> { /* ... */ }
  async all(): Promise<Result<User[], Error>> { /* ... */ }
  async create(data: PartialUser): Promise<Result<User, Error>> { /* ... */ }
  async update(id: UserId, data: UpdateUser): Promise<Result<User, Error>> { /* ... */ }
  async delete(id: UserId): Promise<Result<User, Error>> { /* ... */ }
}
```

**Examples**: Users, Integrations, Templates

#### StandardService - User-Scoped Data

Use for data owned by specific users:

```typescript
// packages/backend/src/services/secrets/SecretsService.ts

class SecretsService extends StandardService<SecretId, Secret> {
  // All methods require userId
  async get(userId: UserId, id: SecretId): Promise<Result<Secret, Error>> { /* ... */ }
  async all(userId: UserId): Promise<Result<Secret[], Error>> { /* ... */ }
  async create(userId: UserId, data: PartialSecret): Promise<Result<Secret, Error>> { /* ... */ }
  async update(userId: UserId, id: SecretId, data: UpdateSecret): Promise<Result<Secret, Error>> { /* ... */ }
  async delete(userId: UserId, id: SecretId): Promise<Result<Secret, Error>> { /* ... */ }
}
```

**Examples**: Secrets, User Settings, User-specific Resources

### Service Architecture

Each service follows a layered architecture:

```
services/users/
├── UsersService.ts           # Service implementation
├── domain/
│   └── UsersService.ts        # Interface definition
├── repos/
│   └── UsersRepo.ts           # Database access
├── cache/
│   └── UsersCache.ts          # Cache layer
├── actions/
│   ├── createUser.ts          # Business logic
│   └── validateUser.ts
├── __tests__/
│   └── UsersService.integration.test.ts
└── __mocks__/
    └── UsersService.mock.ts
```

**Layers**:
1. **Service**: Orchestrates repos, cache, and actions
2. **Repo**: Database operations
3. **Cache**: Caching layer
4. **Actions**: Pure business logic

## Dependency Injection

### Direct Service Creation

Services are created directly using factory functions where needed:

```typescript
// In HTTP handlers
import { createUsersService } from '@backend/users';

class UsersHttpHandler {
  constructor(private readonly ctx: { 
    readonly logger: ILogger; 
    readonly appConfig: IAppConfigurationService;
  }) {
    const usersService = createUsersService({
      logger: ctx.logger,
      appConfig: ctx.appConfig,
    });
    
    // Use service...
  }
}
```

### Composing Services

When one service depends on another, create them in the constructor:

```typescript
// Service that depends on other services
export function createSecretsService(ctx: SecretsServiceContext) {
  return Object.freeze(new SecretsService(ctx));
}

interface SecretsServiceContext {
  readonly logger: ILogger;
  readonly appConfig: IAppConfigurationService;
  readonly encryptionService: IEncryptionService;
}

interface SecretsServiceDependencies {
  readonly createSecretsRepo: typeof createSecretsRepo;
  readonly createSecretsCache: typeof createSecretsCache;
}

class SecretsService {
  constructor(
    private readonly ctx: SecretsServiceContext,
    private readonly dependencies: SecretsServiceDependencies = {
      createSecretsRepo,
      createSecretsCache,
    }
  ) {
    super('secrets', {
      ...ctx,
      repo: () => this.dependencies.createSecretsRepo({ 
        appConfig: ctx.appConfig 
      }),
      cache: () => this.dependencies.createSecretsCache({ 
        logger: ctx.logger, 
        appConfig: ctx.appConfig 
      }),
      newId: SecretId,
    });
  }
}

// Usage - create encryption service first, then pass to secrets service
const encryptionService = createRSAEncryptionService({ logger });
const secretsService = createSecretsService({
  logger,
  appConfig: config,
  encryptionService,
});
```

### Handler Pattern

HTTP handlers receive dependencies and create services internally:

```typescript
// apps/api/src/handlers.manifest.ts
export function createHandlers(deps: {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}): IHttpHandler[] {
  const routeFactory = createRouteFactory(deps);
  
  return [
    createAPIUserHandlers({ ...deps, routeFactory }),
    createTasksHttpHandler({ ...deps, routeFactory }),
  ];
}

// packages/backend/src/users/handlers/http/UsersHttpHandler.ts
export function createAPIUserHandlers(ctx: {
  readonly logger: ILogger;
  readonly appConfig: IAppConfigurationService;
  readonly routeFactory: IHttpRouteFactory;
}): IHttpHandler {
  // Service created inside handler
  const usersService = createUsersService({
    logger: ctx.logger,
    appConfig: ctx.appConfig,
  });
  
  return Object.freeze(new UsersHttpHandler({ ...ctx, service: usersService }));
}
```

## Error Handling Strategy

### Error Types

```typescript
// Core error types in @core/errors/

ErrorWithMetadata      // Base error with metadata and code
NotFoundError          // 404 - Resource not found
UnauthorizedError      // 401 - Authentication required
ValidationError        // 400 - Validation failed
TimeoutError           // 408 - Request timeout
HttpRequestError       // HTTP request failures
```

### Using Errors

```typescript
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { NotFoundError } from '@core/errors/NotFoundError';
import { ValidationError } from '@core/errors/ValidationError';

// Create errors with context
return err(new NotFoundError('User not found', {
  userId,
  correlationId,
}));

return err(new ErrorWithMetadata(
  'Failed to create user',
  'InternalServer',
  { originalError: error.message },
));
```

### Error Propagation

```typescript
// Let errors bubble up
async function handler(request: Request): Promise<Result<Response, Error>> {
  const userResult = await usersService.get(userId);
  if (userResult.isErr()) {
    // Just return the error - don't wrap unnecessarily
    return err(userResult.error);
  }
  
  // Continue with success case
  const user = userResult.value;
  // ...
}
```

## Immutability

### Prefer const

```typescript
// ✅ GOOD
const user = { id: userId, name: 'John' };
const users = [user1, user2];

// ❌ BAD
let user = { id: userId, name: 'John' };
user.name = 'Jane';  // Mutation
```

### Updating Objects

```typescript
// ✅ GOOD - create new object
const updatedUser = {
  ...user,
  name: 'Jane',
};

// ❌ BAD - mutate existing
user.name = 'Jane';
```

### Updating Arrays

```typescript
// ✅ GOOD - create new array
const updatedUsers = [...users, newUser];
const filteredUsers = users.filter(u => u.active);

// ❌ BAD - mutate existing
users.push(newUser);
users.splice(0, 1);
```

## Type Safety

### Branded Types

Use branded types for IDs to prevent mixing different ID types:

```typescript
import zod from 'zod';

export type UserId = zod.infer<typeof userIdSchema>;

export const userIdSchema = zod
  .string()
  .brand<'UserId'>()
  .describe('the id of a user');

// Now you can't accidentally use SecretId where UserId is expected
```

See [Domain Modeling Guide](./domain-modeling.md) for more details.

### Discriminated Unions

```typescript
// Schema versioning
const userV1Schema = baseUserSchema.extend({
  schemaVersion: zod.literal(1),
});

const userV2Schema = baseUserSchema.extend({
  schemaVersion: zod.literal(2),
  newField: zod.string(),
});

export const userSchema = zod.discriminatedUnion('schemaVersion', [
  userV1Schema,
  userV2Schema,
]);

// TypeScript knows which fields exist based on schemaVersion
```

## Practical Examples

### Complete Service Usage

```typescript
// Create service
const usersService = createUsersService({
  logger,
  appConfig: createAppConfigurationService(),
});

// Use service
const result = await usersService.create({
  schemaVersion: 1,
  email: 'user@example.com',
  name: 'John Doe',
});

if (result.isErr()) {
  logger.error('Failed to create user', result.error);
  return err(result.error);
}

const user = result.value;
logger.info('User created', { userId: user.id });
```

### Action with Context

```typescript
// Define action
function processPayment(
  ctx: { readonly logger: ILogger },
  request: { readonly amount: number; readonly userId: UserId },
): Result<PaymentResult, ErrorWithMetadata> {
  if (request.amount <= 0) {
    return err(new ErrorWithMetadata('Invalid amount', 'BadRequest'));
  }
  
  ctx.logger.info('Processing payment', {
    amount: request.amount,
    userId: request.userId,
  });
  
  // Pure business logic...
  
  return ok({ success: true, transactionId: generateId() });
}

// Use in service
const paymentResult = processPayment(
  { logger: this.context.logger },
  { amount: 100, userId },
);
```

## Summary

Key architectural patterns:

1. **Result Types**: Type-safe error handling with `ok()` and `err()`
2. **Factory Functions**: `createX()` pattern for creating instances
3. **Context Objects**: Pass dependencies via structured context
4. **Action Pattern**: Pure business logic in `actions/` folder
5. **Service Patterns**: SharedService for global data, StandardService for user-scoped data
6. **Dependency Injection**: Direct service creation via factory functions
7. **Immutability**: Prefer const, avoid mutations

## Next Steps

- [Domain Modeling Guide](./domain-modeling.md) - Learn Zod schema patterns
- [Services Guide](./services.md) - Create your first service
- [Testing Guide](./testing.md) - Test these patterns
- [Code Style Guide](./code-style.md) - Understand enforced patterns
