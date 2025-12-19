# HTTP Handlers Guide

This guide covers creating HTTP endpoints in Autoflow using the route factory pattern with automatic middleware orchestration.

## Overview

HTTP handlers in Autoflow:
- Use the `HttpRouteFactory` for creating routes
- Support middleware-based authentication and authorization
- Follow functional patterns with Result types
- Receive services via dependency injection
- Return standard HTTP responses

## Route Types and Middleware

Routes come in three types, each with different middleware:

| Route Type | Use Case | Middleware | Authentication |
|------------|----------|------------|----------------|
| `public` | Health checks, public APIs | None | No |
| `api` | REST API endpoints | Bearer token, permissions | Yes |
| `app` | Server-rendered pages | Cookie session, permissions | Yes |

The middleware is automatically applied based on the `routeType` specified when creating a route.

## Architecture

### Request Flow

```
Incoming Request
    ↓
1. Middleware Pipeline (based on routeType)
    - public: No middleware
    - api: Bearer token authentication → Permission check
    - app: Cookie authentication → Permission check
    ↓
2. Request Context Building
    - Extract correlation ID from headers (or generate new)
    - Extract abort signal from Request
    - Build RequestContext with helpers (getParam, getBody, etc.)
    ↓
3. Context Creation
    - Create Context from RequestContext
    - Context = { correlationId, signal }
    ↓
4. Handler Execution
    - Pass Context to service calls
    - Business logic runs with distributed tracing
    ↓
5. Response
    - Success: Return Response
    - Error: Convert to appropriate HTTP status
```

### Middleware Configuration

Middleware is configured using `RouteMiddlewareConfig`:

```typescript
interface RouteMiddlewareConfig {
  api: MiddlewareFactory[];   // Middleware for API routes
  app: MiddlewareFactory[];   // Middleware for app routes  
  public: MiddlewareFactory[]; // Middleware for public routes (usually empty)
}

type MiddlewareFactory = (config: MiddlewareConfig) => IHttpMiddleware[];

interface MiddlewareConfig {
  requiredPermissions?: Permission[];
}
```

Middleware factories receive configuration (like required permissions) and return middleware to execute.

## Creating Routes

### Using SharedHTTPHandler (Recommended)

For standard CRUD operations, extend `SharedHTTPHandler`:

```typescript
// packages/backend/src/users/handlers/http/UsersHttpHandler.ts

import { SharedHTTPHandler } from '@backend/infrastructure/http/handlers/SharedHttpHandler';
import { createUsersService, type IUsersService } from '@backend/users';
import type { User, UserId } from '@core/domain/user/user';
import {
  validPartialUser,
  validUpdateUser,
  validUser,
  validUserId,
} from '@core/domain/user/validation/validUser';

export function createAPIUserHandlers(
  context: UsersHttpHandlersContext,
): IHttpHandler {
  return new UsersHttpHandlers(context);
}

interface UsersHttpHandlersContext {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  routeFactory: IHttpRouteFactory;
}

class UsersHttpHandlers
  extends SharedHTTPHandler<UserId, User>
  implements IHttpHandler
{
  constructor(readonly ctx: UsersHttpHandlersContext) {
    const usersService: IUsersService = createUsersService({
      logger: ctx.logger,
      appConfig: () => ctx.appConfig,
    });

    super({
      ...ctx,
      service: () => usersService,
      validators: {
        id: validUserId,
        item: validUser,
        partial: validPartialUser,
        update: validUpdateUser,
      },
    });
  }

  routes() {
    return super.routes({
      type: 'api',
      readPermissions: ['admin', 'read:users'],
      writePermissions: ['admin', 'write:users'],
    });
  }
}
```

This automatically creates:
- `GET /api/users/:id` - Get single user (requires read permissions)
- `GET /api/users` - Get all users (requires read permissions)
- `POST /api/users` - Create user (requires write permissions)
- `PUT /api/users/:id` - Update user (requires write permissions)
- `DELETE /api/users/:id` - Delete user (requires write permissions)

### Custom Routes

For custom endpoints, use the route factory directly:

```typescript
class CustomHandler implements IHttpHandler {
  constructor(
    private readonly ctx: {
      logger: ILogger;
      appConfig: IAppConfigurationService;
      routeFactory: IHttpRouteFactory;
    },
  ) {}

  routes(): IHttpRoute[] {
    return [
      this.healthCheck(),
      this.getUserProfile(),
    ];
  }

  private healthCheck(): IHttpRoute {
    return this.ctx.routeFactory.createRoute({
      path: '/health',
      method: 'GET',
      routeType: 'public', // No authentication
      handler: async () => {
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
  }

  private getUserProfile(): IHttpRoute {
    return this.ctx.routeFactory.createRoute({
      path: '/api/users/:id/profile',
      method: 'GET',
      routeType: 'api',
      requiredPermissions: ['read:users'], // Requires permission
      handler: async ({ getParam }) => {
        const userId = getParam('id', validUserId);
        if (userId.isErr()) {
          return buildHttpErrorResponse(userId.error);
        }

        // Business logic here
        const result = await this.getUserProfileData(userId.value);
        
        if (result.isErr()) {
          return buildHttpErrorResponse(result.error);
        }

        return Response.json(result.value, { status: 200 });
      },
    });
  }
}
```

## Request Context and Context

Handlers receive a `RequestContext` with helper methods, which contains everything needed to create a `Context` for service calls.

### RequestContext (HTTP-specific)

```typescript
interface RequestContext {
  correlationId: CorrelationId;  // For distributed tracing
  signal: AbortSignal;           // For request cancellation
  
  // Extract URL parameters
  getParam<T>(name: string, validator: Validator<T>): Result<T, ErrorWithMetadata>;
  
  // Extract query parameters
  getSearchParam<T>(name: string, validator: Validator<T>): Result<T, ErrorWithMetadata>;
  
  // Extract and validate request body
  getBody<T>(validator: Validator<T>): Promise<Result<T, ErrorWithMetadata>>;
  
  // Get request headers
  getHeader(name: string): string | null;
  
  // Optional: User session (if authenticated)
  session?: UserSession;
}
```

### Context (Service layer)

Create a `Context` from `RequestContext` to pass to services:

```typescript
import { fromRequestContext } from '@backend/infrastructure/context';

handler: async (requestContext) => {
  // Create Context for service calls
  const ctx = fromRequestContext(requestContext);
  
  // Now pass ctx to all service operations
  const result = await service.get(ctx, id);
}
```

### Example Usage

```typescript
import { fromRequestContext } from '@backend/infrastructure/context';
import { buildHttpErrorResponse } from '@backend/infrastructure/http/handlers/errors/buildHttpErrorResponse';

handler: async (requestContext) => {
  // 1. Create Context for service layer
  const ctx = fromRequestContext(requestContext);
  
  // 2. Extract and validate URL parameter
  const userId = requestContext.getParam('id', validUserId);
  if (userId.isErr()) {
    return buildHttpErrorResponse(userId.error);
  }

  // 3. Extract and validate request body
  const body = await requestContext.getBody(validCreateUserRequest);
  if (body.isErr()) {
    return buildHttpErrorResponse(body.error);
  }

  // 4. Call service with Context
  const result = await service.create(ctx, body.value);
  
  if (result.isErr()) {
    return buildHttpErrorResponse(result.error);
  }

  return Response.json(result.value, { status: 201 });
}
```

**Key Points**:
- `RequestContext` is HTTP-specific (has helpers like `getParam`, `getBody`)
- `Context` is for service layer (has `correlationId`, `signal`)
- Convert `RequestContext` → `Context` using `fromRequestContext()`
- Pass `Context` to all service calls for distributed tracing

## Error Handling

### Using buildHttpErrorResponse

Convert errors to appropriate HTTP responses:

```typescript
import { buildHttpErrorResponse } from '@backend/infrastructure/http/handlers/errors/buildHttpErrorResponse';

const result = await service.get(id);

if (result.isErr()) {
  return buildHttpErrorResponse(result.error);
}

// Error code to HTTP status mapping:
// BadRequest → 400
// Unauthorized → 401
// Forbidden → 403
// NotFound → 404
// Timeout → 408
// InternalServer → 500
```

### Error Types

```typescript
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { NotFoundError } from '@core/errors/NotFoundError';

// Not found
if (!user) {
  return err(new NotFoundError('User not found', { userId }));
}

// Validation error
return err(new ErrorWithMetadata('Invalid email', 'BadRequest'));

// Generic error with metadata
return err(new ErrorWithMetadata(
  'Failed to process request',
  'InternalServer',
  { originalError: error.message }
));
```

## Testing HTTP Handlers

### Unit Testing Custom Routes

```typescript
import { describe, expect, it, mock } from 'bun:test';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { ok } from 'neverthrow';

describe('CustomHandler', () => {
  it('should create route with middleware config', () => {
    const logger = getMockedLogger();
    const appConfig = getMockedAppConfigurationService();
    
    const mockMiddlewareFactory = mock(() => []);
    const middlewareConfig = {
      api: [mockMiddlewareFactory],
      app: [],
      public: [],
    };
    
    const mockRouteFactory = {
      createRoute: mock((params) => ({
        path: params.path,
        method: params.method,
        handler: params.handler,
      })),
    };

    const handler = new CustomHandler({
      logger,
      appConfig,
      routeFactory: mockRouteFactory,
    });

    const routes = handler.routes();
    
    expect(routes.length).toBeGreaterThan(0);
    expect(mockRouteFactory.createRoute).toHaveBeenCalled();
  });
});
```

### Integration Testing

```typescript
import { setupHttpIntegrationTest } from '@backend/testing/integration/httpIntegrationTest';
import { createUsersService } from '@backend/users';

describe('UsersHttpHandler Integration', () => {
  const { getHttpServer, getHttpClient, getTestAuth, getConfig, getLogger } = 
    setupHttpIntegrationTest();

  beforeAll(async () => {
    const config = getConfig();
    const logger = getLogger();
    
    // Create handlers with route factory
    const handlers = [
      createAPIUserHandlers({
        logger,
        appConfig: config,
        routeFactory: getRouteFactory(),
      }),
    ];

    await getHttpServer().start(handlers);
  });

  it('should get user by id with authentication', async () => {
    // Create service directly for test setup
    const usersService = createUsersService({
      logger: getLogger(),
      appConfig: () => getConfig(),
    });
    
    // Create test user
    const createResult = await usersService.create({
      schemaVersion: 1,
      email: 'test@example.com',
      name: 'Test User',
    });
    const user = createResult._unsafeUnwrap();

    // Make authenticated request
    const client = getHttpClient();
    const auth = getTestAuth();
    const headers = await auth.createAdminHeaders();

    const response = await client.get(`/api/users/${user.id}`, { headers });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(user.id);
    expect(body.email).toBe('test@example.com');
  });

  it('should return 401 without authentication', async () => {
    const client = getHttpClient();
    const response = await client.get('/api/users/123');

    expect(response.status).toBe(401);
  });

  it('should return 403 without required permissions', async () => {
    const client = getHttpClient();
    const auth = getTestAuth();
    const headers = await auth.createUserHeaders(); // Limited permissions

    const response = await client.get('/api/users', { headers });

    expect(response.status).toBe(403);
  });
});
```

## Permissions

Permissions control access to routes:

```typescript
// Single permission
requiredPermissions: ['admin']

// Multiple permissions (user must have ALL)
requiredPermissions: ['admin', 'write:users']

// Separate read/write permissions
super.routes({
  type: 'api',
  readPermissions: ['admin', 'read:users'],
  writePermissions: ['admin', 'write:users'],
})

// No permissions required (but still authenticated)
requiredPermissions: []
```

### Available Permissions

```typescript
type Permission = 
  | 'admin'
  | 'read:users'
  | 'write:users'
  | 'read:secrets'
  | 'write:secrets'
  // ... more permissions
```

See `packages/core/src/domain/permissions/permissions.ts` for all available permissions.

## Best Practices

### 1. Use SharedHTTPHandler for CRUD

For standard CRUD operations, always use `SharedHTTPHandler` instead of creating routes manually.

### 2. Validate All Inputs

Always validate URL params, query params, and request bodies using validators:

```typescript
const userId = ctx.getParam('id', validUserId);
if (userId.isErr()) {
  return buildHttpErrorResponse(userId.error);
}
```

### 3. Return Result Types

Services should return `Result` types, never throw exceptions:

```typescript
// ✅ GOOD
const result = await service.get(id);
if (result.isErr()) {
  return buildHttpErrorResponse(result.error);
}

// ❌ BAD
try {
  const user = await service.get(id); // Don't throw
} catch (error) {
  // ...
}
```

### 4. Use Appropriate Route Types

- `public`: Only for truly public endpoints (health checks, webhooks)
- `api`: For API endpoints requiring bearer token auth
- `app`: For server-rendered pages with cookie auth

### 5. Be Specific with Permissions

Use granular permissions instead of just `admin`:

```typescript
// ✅ GOOD - granular
readPermissions: ['admin', 'read:users']
writePermissions: ['admin', 'write:users']

// ❌ BAD - too broad
requiredPermissions: ['admin']
```

## Advanced Patterns

### Custom Middleware

To add custom middleware, create a middleware factory:

```typescript
import type { MiddlewareFactory } from '@backend/infrastructure/http/handlers/middleware/domain/MiddlewareConfig';

const rateLimitMiddleware: MiddlewareFactory = (config) => {
  return [{
    name: 'rate-limit',
    handler: async (request) => {
      // Rate limiting logic
      if (isRateLimited(request)) {
        return err(new ErrorWithMetadata('Too many requests', 'TooManyRequests'));
      }
      return ok(request);
    },
  }];
};

// Use in middleware config
const middlewareConfig: RouteMiddlewareConfig = {
  api: [authMiddleware, rateLimitMiddleware],
  app: [cookieAuthMiddleware],
  public: [],
};
```

### Streaming Responses

```typescript
handler: async (ctx) => {
  const stream = new ReadableStream({
    async start(controller) {
      // Stream data
      controller.enqueue(new TextEncoder().encode('chunk 1\n'));
      controller.enqueue(new TextEncoder().encode('chunk 2\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
```

### File Uploads

```typescript
handler: async (ctx) => {
  const formData = await ctx.request.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return buildHttpErrorResponse(
      new ErrorWithMetadata('No file provided', 'BadRequest')
    );
  }

  const buffer = await file.arrayBuffer();
  // Process file...

  return Response.json({ success: true }, { status: 200 });
}
```

## Next Steps

- [Services Guide](./services.md) - Create services to use in handlers
- [Testing Guide](./testing.md) - Test your handlers thoroughly
- [Architecture Guide](./architecture.md) - Understand Result types and error handling
- [Domain Modeling Guide](./domain-modeling.md) - Create validators for request data
