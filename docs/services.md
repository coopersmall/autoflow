# Services Guide

This guide explains how to create new services in Autoflow, following our established patterns for repos, caches, actions, and service registration.

## Context Pattern

All service operations accept a `Context` as the first parameter. Context provides:
- **Distributed tracing** via `correlationId` - track requests across services
- **Operation cancellation** via `signal` - abort long-running operations

```typescript
import type { Context } from '@backend/infrastructure/context';

// Service method signature
async get(ctx: Context, id: WidgetId): Promise<Result<Widget, Error>>
```

The Context flows through all layers:
```
HTTP Handler → Service → Action → Repo/Cache
```

## Quick Start

Creating a new service involves:
1. Define domain model in `packages/core/src/domain/`
2. Create service structure in `packages/backend/src/<feature>/`
3. Export from feature module's `index.ts`
4. Add HTTP handlers if needed

## When to Create a Service

Create a service when you need to:
- Manage a new domain entity (Users, Secrets, etc.)
- Provide business logic operations on data
- Coordinate repos, caches, and external APIs
- Expose functionality to HTTP handlers or other services

## Service Types

### SharedService - Global Data

Use for data not owned by specific users:

**Examples**: Users, global templates, system configurations

```typescript
class UsersService extends SharedService<UserId, User> {
  async get(ctx: Context, id: UserId): Promise<Result<User, Error>>
  async all(ctx: Context): Promise<Result<User[], Error>>
  async create(ctx: Context, data: PartialUser): Promise<Result<User, Error>>
}
```

### StandardService - User-Scoped Data

Use for data owned by individual users:

**Examples**: Secrets, user settings, user-specific resources

```typescript
class SecretsService extends StandardService<SecretId, Secret> {
  async get(ctx: Context, id: SecretId, userId: UserId): Promise<Result<Secret, Error>>
  async all(ctx: Context, userId: UserId): Promise<Result<Secret[], Error>>
  async create(ctx: Context, data: PartialSecret, userId: UserId): Promise<Result<Secret, Error>>
}
```

## Step-by-Step: Creating a Service

### Step 1: Create Domain Model

See [Domain Modeling Guide](./domain-modeling.md) for details.

```typescript
// packages/core/src/domain/widget/widget.ts

import { newId } from '@core/domain/Id';
import { createItemSchema } from '@core/domain/Item';
import zod from 'zod';

export type WidgetId = zod.infer<typeof widgetIdSchema>;
export const WidgetId = newId<WidgetId>;

export const widgetIdSchema = zod
  .string()
  .brand<'WidgetId'>()
  .describe('the id of a widget');

const baseWidgetSchema = createItemSchema(widgetIdSchema).extend({
  name: zod.string().min(1).describe('the widget name'),
  value: zod.number().describe('the widget value'),
});

const widgetV1Schema = baseWidgetSchema.extend({
  schemaVersion: zod.literal(1),
});

export const widgetSchema = zod.discriminatedUnion('schemaVersion', [
  widgetV1Schema,
]);

export type Widget = zod.infer<typeof widgetSchema>;
```

Create validation:

```typescript
// packages/core/src/domain/widget/validation/validWidget.ts

import { validate } from '@core/validation/validate';
import { widgetSchema, type Widget } from '@core/domain/widget/widget';

export function validWidget(input: unknown): Result<Widget, ValidationError> {
  return validate(widgetSchema, input);
}
```

### Step 2: Create Service Structure

Services are organized by feature module in `packages/backend/src/<feature>/`:

```
packages/backend/src/widgets/
├── WidgetsService.ts           # Service implementation
├── domain/
│   └── WidgetsService.ts        # Interface definition
├── repos/
│   └── WidgetsRepo.ts           # Database operations
├── cache/
│   └── WidgetsCache.ts          # Cache layer
├── actions/
│   ├── processWidget.ts         # Business logic
│   └── __tests__/
│       └── processWidget.test.ts
├── handlers/
│   └── http/
│       └── WidgetsHttpHandler.ts
├── __tests__/
│   └── WidgetsService.integration.test.ts
├── __mocks__/
│   └── WidgetsService.mock.ts
└── index.ts                     # Public exports
```

### Step 3: Define Service Interface

```typescript
// packages/backend/src/widgets/domain/WidgetsService.ts

import type { Context } from '@backend/infrastructure/context';
import type { Widget, WidgetId } from '@core/domain/widget/widget';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

export interface IWidgetsService {
  get(ctx: Context, id: WidgetId): Promise<Result<Widget, ErrorWithMetadata>>;
  all(ctx: Context): Promise<Result<Widget[], ErrorWithMetadata>>;
  create(ctx: Context, data: PartialWidget): Promise<Result<Widget, ErrorWithMetadata>>;
  update(ctx: Context, id: WidgetId, data: UpdateWidget): Promise<Result<Widget, ErrorWithMetadata>>;
  delete(ctx: Context, id: WidgetId): Promise<Result<Widget, ErrorWithMetadata>>;
}
```

**Note**: Context is always the first parameter for distributed tracing and cancellation support.

### Step 4: Create Repository

```typescript
// packages/backend/src/widgets/repos/WidgetsRepo.ts

import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { SharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import { validWidget } from '@core/domain/widget/validation/validWidget';
import { type Widget, WidgetId } from '@core/domain/widget/widget';

export { createWidgetsRepo };

function createWidgetsRepo(config: {
  appConfig: IAppConfigurationService;
}) {
  return new SharedRepo<WidgetId, Widget>(
    config.appConfig,
    'widgets',
    validWidget,
  );
}
```

### Step 5: Create Cache (if needed)

```typescript
// packages/backend/src/widgets/cache/WidgetsCache.ts

import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { SharedCache } from '@backend/infrastructure/cache/SharedCache';
import { validWidget } from '@core/domain/widget/validation/validWidget';
import { type Widget, WidgetId } from '@core/domain/widget/widget';

export { createWidgetsCache };

function createWidgetsCache(config: {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}) {
  return new SharedCache<WidgetId, Widget>({
    ...config,
    keyPrefix: 'widget',
    validator: validWidget,
  });
}
```

### Step 6: Implement Service

```typescript
// packages/backend/src/widgets/WidgetsService.ts

import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { SharedService } from '@backend/infrastructure/services/SharedService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { type Widget, WidgetId } from '@core/domain/widget/widget';
import { createWidgetsCache } from './cache/WidgetsCache';
import type { IWidgetsService } from './domain/WidgetsService';
import { createWidgetsRepo } from './repos/WidgetsRepo';

export { createWidgetsService };
export type { IWidgetsService };

function createWidgetsService(config: WidgetsServiceConfig): IWidgetsService {
  return Object.freeze(new WidgetsService(config));
}

interface WidgetsServiceConfig {
  readonly appConfig: IAppConfigurationService;
  readonly logger: ILogger;
}

interface WidgetsServiceDependencies {
  readonly createWidgetsRepo: typeof createWidgetsRepo;
  readonly createWidgetsCache: typeof createWidgetsCache;
}

class WidgetsService
  extends SharedService<WidgetId, Widget>
  implements IWidgetsService
{
  constructor(
    private readonly config: WidgetsServiceConfig,
    private readonly dependencies: WidgetsServiceDependencies = {
      createWidgetsRepo,
      createWidgetsCache,
    },
  ) {
    super('widgets', {
      ...config,
      repo: () => this.dependencies.createWidgetsRepo({ 
        appConfig: config.appConfig 
      }),
      cache: () => this.dependencies.createWidgetsCache({
        logger: config.logger,
        appConfig: config.appConfig,
      }),
      newId: WidgetId,
    });
  }
}
```

**Naming Convention**: Use `*Config` for constructor parameters, not `*Context`. The `Context` type is reserved for the request-scoped context parameter.
```

### Step 7: Create Mock

```typescript
// packages/backend/src/widgets/__mocks__/WidgetsService.mock.ts

import type { IWidgetsService } from '@backend/widgets/domain/WidgetsService';
import type { ExtractMockMethods } from '@core/types';
import { mock } from 'bun:test';

export function getMockedWidgetsService(): ExtractMockMethods<IWidgetsService> {
  return {
    get: mock(),
    all: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
  };
}
```

### Step 8: Export from Feature Module

Create an `index.ts` file that exports your service and any handlers:

```typescript
// packages/backend/src/widgets/index.ts

export { createWidgetsService, type IWidgetsService } from './WidgetsService';
export { createWidgetsHttpHandler } from './handlers/http/WidgetsHttpHandler';
```

This allows other modules to import your service:

```typescript
// In handlers or other modules
import { createWidgetsService } from '@backend/widgets';

const widgetsService = createWidgetsService({
  logger,
  appConfig: () => config,
});
```

### Step 9: Add to Handlers Manifest (Optional)

If you created HTTP handlers, add them to the API handlers manifest:

```typescript
// apps/api/src/handlers.manifest.ts

import { createWidgetsHttpHandler } from '@autoflow/backend/widgets';

export function createHandlers(deps: HandlerDeps): IHttpHandler[] {
  const routeFactory = createRouteFactory(deps);

  return [
    createAPIUserHandlers({ ...deps, routeFactory }),
    createTasksHttpHandler({ ...deps, routeFactory }),
    createWidgetsHttpHandler({ ...deps, routeFactory }), // <- Add here
  ];
}
```

## Adding Business Logic (Actions)

Actions are pure functions for business logic. They follow the pattern:

```typescript
function actionName(
  ctx: Context,           // 1st - Request context (correlationId, signal)
  request: RequestType,   // 2nd - Request data
  deps: DepsType,         // 3rd - Dependencies (last)
): Promise<Result<T, E>>
```

Example:

```typescript
// packages/backend/src/widgets/actions/processWidget.ts

import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { Widget } from '@core/domain/widget/widget';
import { ok, type Result } from 'neverthrow';

export interface ProcessWidgetDeps {
  readonly logger: ILogger;
}

export interface ProcessWidgetRequest {
  readonly widget: Widget;
  readonly multiplier: number;
}

export function processWidget(
  ctx: Context,
  request: ProcessWidgetRequest,
  deps: ProcessWidgetDeps,
): Result<number, never> {
  const result = request.widget.value * request.multiplier;
  
  // Use ctx.correlationId for tracing
  deps.logger.debug('Processed widget', {
    correlationId: ctx.correlationId,
    widgetId: request.widget.id,
    result,
  });
  
  // Check for cancellation in long operations
  if (ctx.signal.aborted) {
    return err(new ErrorWithMetadata('Operation cancelled', 'Cancelled'));
  }
  
  return ok(result);
}
```

Use in service:

```typescript
class WidgetsService extends SharedService<WidgetId, Widget> {
  async process(ctx: Context, id: WidgetId, multiplier: number): Promise<Result<number, Error>> {
    const widgetResult = await this.get(ctx, id);
    if (widgetResult.isErr()) {
      return err(widgetResult.error);
    }
    
    return processWidget(
      ctx,  // Pass context through
      { widget: widgetResult.value, multiplier },
      { logger: this.config.logger },
    );
  }
}
```

**Key Points**:
- Context is **always first parameter**
- Use `*Deps` for dependencies (not `*Context`)
- Pass `ctx` through all async operations
- Check `ctx.signal.aborted` before expensive operations

## Testing Services

### Integration Tests

```typescript
// packages/backend/src/widgets/__tests__/WidgetsService.integration.test.ts

import { createWidgetsService } from '@backend/widgets/WidgetsService';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { describe, expect, it } from 'bun:test';

describe('WidgetsService Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  const setup = () => {
    return createWidgetsService({
      appConfig: () => getConfig(),
      logger: getLogger(),
    });
  };

  describe('create()', () => {
    it('should create a widget in database', async () => {
      expect.assertions(3);
      
      const service = setup();

      const result = await service.create({
        schemaVersion: 1,
        name: 'Test Widget',
        value: 42,
      });

      expect(result.isOk()).toBe(true);
      const widget = result._unsafeUnwrap();
      expect(widget.id).toBeDefined();
      expect(widget.name).toBe('Test Widget');
    });
  });
});
```

See [Testing Guide](./testing.md) for more patterns.

## HTTP Handlers

Create handlers to expose your service via HTTP using `SharedHTTPHandler`:

```typescript
// packages/backend/src/widgets/handlers/http/WidgetsHttpHandler.ts

import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { IHttpHandler } from '@backend/infrastructure/http/domain/HttpHandler';
import type { IHttpRouteFactory } from '@backend/infrastructure/http/handlers/domain/HttpRouteFactory';
import { SharedHTTPHandler } from '@backend/infrastructure/http/handlers/SharedHttpHandler';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { createWidgetsService, type IWidgetsService } from '@backend/widgets';
import type { Widget, WidgetId } from '@core/domain/widget/widget';
import {
  validPartialWidget,
  validUpdateWidget,
  validWidget,
  validWidgetId,
} from '@core/domain/widget/validation/validWidget';

export function createWidgetsHttpHandler(
  context: WidgetsHttpHandlerContext,
): IHttpHandler {
  return Object.freeze(new WidgetsHttpHandler(context));
}

interface WidgetsHttpHandlerContext {
  readonly logger: ILogger;
  readonly appConfig: IAppConfigurationService;
  readonly routeFactory: IHttpRouteFactory;
}

class WidgetsHttpHandler
  extends SharedHTTPHandler<WidgetId, Widget>
  implements IHttpHandler
{
  constructor(private readonly ctx: WidgetsHttpHandlerContext) {
    // Create service directly in constructor
    const widgetsService: IWidgetsService = createWidgetsService({
      logger: ctx.logger,
      appConfig: ctx.appConfig,
    });

    super({
      ...ctx,
      service: () => widgetsService,
      validators: {
        id: validWidgetId,
        item: validWidget,
        partial: validPartialWidget,
        update: validUpdateWidget,
      },
    });
  }

  routes() {
    return super.routes({
      type: 'api',
      readPermissions: ['admin', 'read:widgets'],
      writePermissions: ['admin', 'write:widgets'],
    });
  }
}
```

This automatically creates CRUD endpoints:
- `GET /api/widgets/:id` - Get single widget
- `GET /api/widgets` - Get all widgets
- `POST /api/widgets` - Create widget
- `PUT /api/widgets/:id` - Update widget
- `DELETE /api/widgets/:id` - Delete widget

See [HTTP Handlers Guide](./http-handlers.md) for more details.

## Best Practices

1. **Use SharedService or StandardService** - Don't create custom base classes
2. **Keep services thin** - Delegate business logic to actions
3. **Return Result types** - Never throw errors
4. **Use dependency injection** - Pass context objects
5. **Write integration tests** - Test the full stack
6. **Mock external dependencies** - Use factory pattern for testability
7. **Log operations** - Include context for debugging
8. **Validate inputs** - Use Zod schemas

## Next Steps

- [Domain Modeling Guide](./domain-modeling.md) - Create domain models
- [Architecture Guide](./architecture.md) - Understand patterns
- [Testing Guide](./testing.md) - Test your service
- [HTTP Handlers Guide](./http-handlers.md) - Expose via API
- [Background Tasks Guide](./background-tasks.md) - Add async operations
