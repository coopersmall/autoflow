# @autoflow/backend

Server-side business logic, data access, and infrastructure. This package contains services, repositories, caching, HTTP handlers, and background task processing.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      HTTP Request                           │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Handlers                            │
│              (Authentication, Routing)                      │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Services                               │
│            (Business Logic, Orchestration)                  │
└──────────┬─────────────────────────────────┬────────────────┘
           ▼                                 ▼
┌─────────────────────┐           ┌─────────────────────┐
│    Repositories     │           │       Cache         │
│   (Data Access)     │           │  (Redis/In-Memory)  │
└──────────┬──────────┘           └──────────┬──────────┘
           ▼                                 ▼
┌─────────────────────┐           ┌─────────────────────┐
│    PostgreSQL       │           │       Redis         │
└─────────────────────┘           └─────────────────────┘
```

## Core Patterns

### Shared vs Standard

Two base class patterns for different data access needs:

| Pattern | Use Case | User Scoping |
|---------|----------|--------------|
| **Shared** | Global data (users, config, system settings) | No `userId` required |
| **Standard** | User-owned data (secrets, integrations) | Requires `userId` |

```typescript
// SharedService/SharedRepo - no user scoping
const user = await usersService.get(userId);

// StandardService/StandardRepo - user-scoped
const secrets = await secretsService.all(userId);
```

### Result Types

All fallible operations return `Result<T, Error>` instead of throwing:

```typescript
const result = await service.create(data);

if (result.isErr()) {
  logger.error('Creation failed', result.error);
  return err(result.error);
}

return ok(result.value);
```

### Dependency Injection

Services use factory functions with context objects:

```typescript
const usersService = createUsersService({
  logger,
  appConfig,
  repo: () => createUsersRepo(appConfig),
  cache: () => createUsersCache({ logger, appConfig }),
});
```

## Services

Services contain business logic and orchestrate repositories and caches.

### Base Classes

```typescript
// For global data
class SharedService<ID, T> {
  get(id: ID): Promise<Result<T, Error>>
  all(): Promise<Result<T[], Error>>
  create(data: Omit<T, 'id'>): Promise<Result<T, Error>>
  update(id: ID, data: Partial<T>): Promise<Result<T, Error>>
  delete(id: ID): Promise<Result<T, Error>>
}

// For user-scoped data
class StandardService<ID, T> extends SharedService<ID, T> {
  get(userId: UserId, id: ID): Promise<Result<T, Error>>
  all(userId: UserId): Promise<Result<T[], Error>>
  // ... all methods require userId
}
```

### Available Services

| Service | Pattern | Description |
|---------|---------|-------------|
| `UsersService` | Shared | User management |
| `SecretsService` | Standard | Encrypted secrets |
| `IntegrationsService` | Standard | External service connections |
| `JWTService` | - | JWT token operations |
| `UserAuthenticationService` | - | Authentication logic |
| `AppConfigurationService` | - | Environment configuration |
| `RSAEncryptionService` | - | RSA encryption operations |
| `AIService` | - | AI model interactions |

## Repositories

Repositories handle database operations with automatic validation.

### Features

- Zod validation on all data leaving the database
- Snake_case to camelCase conversion
- Result types for error handling
- Lazy database connection initialization

```typescript
class SharedRepo<ID, T> {
  // Validates and converts results automatically
  async get(id: ID): Promise<Result<T, DBError>>
  async all(opts?: { limit?: number }): Promise<Result<T[], DBError>>
  async create(id: ID, data: CreateData<T>): Promise<Result<T, DBError>>
  async update(id: ID, data: Partial<T>): Promise<Result<T, DBError>>
  async delete(id: ID): Promise<Result<T, DBError>>
  
  // Direct access for complex queries
  getClient(): Result<IDatabaseClient, DBError>
}
```

### Database

- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Schema**: Located in `src/db/schema.ts`
- **Migrations**: Via `drizzle-kit`

## Cache

Caching layer with Redis adapter and cache-aside pattern.

### Features

- Automatic serialization/deserialization
- Cache-aside pattern with `onMiss` callback
- TTL support
- Namespace-based key generation

```typescript
const cache = new SharedCache('users', {
  logger,
  appConfig,
  validator: validUser,
});

// Get with automatic cache-aside
const result = await cache.get(userId, async (id) => {
  return await repo.get(id);
});
```

### Cache Key Format

```
{namespace}/{id}           # SharedCache
{namespace}/{userId}/{id}  # StandardCache
```

## HTTP Layer

HTTP handlers and middleware for the API server.

### Handler Pattern

```typescript
class UsersHttpHandler extends SharedHttpHandler<UserId, User> {
  routes() {
    return [
      ...super.routes({
        type: 'api',
        readPermissions: ['admin', 'read:users'],
        writePermissions: ['admin'],
      }),
      // Custom routes
      this.customEndpoint(),
    ];
  }
}
```

### Middleware

- `createBearerTokenAuthenticationMiddleware` - JWT bearer token auth
- `createCookieAuthenticationMiddleware` - Cookie-based auth

### Server Creation

```typescript
import { createBackendServer } from '@autoflow/backend';

const server = createBackendServer();
server.start({ port: 3000 });
```

## Background Tasks

BullMQ-based background job processing with PostgreSQL audit trail.

See [tasks/README.md](./src/tasks/README.md) for comprehensive documentation.

### Key Concepts

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   TaskScheduler │────▶│  Redis/BullMQ   │────▶│   TaskWorker    │
│   (Producer)    │     │    (Queue)      │     │   (Consumer)    │
└────────┬────────┘     └─────────────────┘     └────────┬────────┘
         │                                               │
         ▼                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PostgreSQL (Audit Trail)                     │
│              TaskRecord: pending → active → completed/failed     │
└─────────────────────────────────────────────────────────────────┘
```

### Defining Tasks

```typescript
const sendEmailTask = defineTask({
  queueName: 'emails:send',
  validator: (data) => validate(emailPayloadSchema, data),
  handler: async (payload, ctx) => {
    await sendEmail(payload.to, payload.subject, payload.body);
    return ok({ success: true, duration: 150 });
  },
  options: { priority: 'high', maxAttempts: 3 },
});
```

### Scheduling Tasks

```typescript
const scheduler = createTaskScheduler({ logger, appConfig });
await scheduler.schedule(correlationId, sendEmailTask, {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Hello...',
});
```

## Directory Structure

```
src/
├── infrastructure/       # Core infrastructure
│   ├── services/         # SharedService & StandardService base classes
│   ├── repos/            # SharedRepo & StandardRepo base classes
│   ├── cache/            # SharedCache & StandardCache base classes
│   ├── http/             # HTTP server, handlers, middleware
│   ├── logger/           # Pino logging wrapper
│   ├── configuration/    # App configuration service
│   ├── db/               # Database schema (Drizzle)
│   ├── queue/            # Queue infrastructure (BullMQ)
│   └── encryption/       # Encryption services
│
├── auth/                 # Authentication & authorization
│   ├── services/         # AuthService
│   ├── middleware/       # Auth middleware factories
│   └── actions/          # JWT creation, validation
│
├── users/                # User management feature
│   ├── UsersService.ts   # User service
│   ├── handlers/         # HTTP handlers
│   ├── repos/            # User repository
│   ├── cache/            # User cache
│   └── index.ts          # Public exports
│
├── secrets/              # Secrets management feature
│   ├── SecretsService.ts # Secrets service
│   ├── handlers/         # HTTP handlers
│   ├── repos/            # Secrets repository
│   ├── cache/            # Secrets cache
│   └── index.ts          # Public exports
│
├── integrations/         # External integrations feature
│   ├── IntegrationsService.ts
│   ├── handlers/
│   └── index.ts
│
├── tasks/                # Background job processing
│   ├── TasksService.ts   # Task management service
│   ├── scheduler/        # Task scheduling
│   ├── worker/           # Task processing
│   ├── handlers/         # HTTP handlers for tasks
│   ├── queue/            # Queue clients
│   └── domain/           # Task types
│
├── ai/                   # AI services
│   ├── AIService.ts
│   └── actions/
│
└── index.ts              # Public exports
```

**Organization Pattern:**
- Features are in their own top-level directories (users, secrets, tasks, etc.)
- Shared infrastructure lives in `infrastructure/`
- Each feature exports its public API from `index.ts`
- Services are created directly via factory functions, no central registry

## Usage

```typescript
import {
  // Services
  createUsersService,
  createSecretsService,
  createBackendServer,
  
  // Tasks
  createTaskScheduler,
  createTaskWorker,
  defineTask,
  
  // Utilities
  getLogger,
} from '@autoflow/backend';
```
