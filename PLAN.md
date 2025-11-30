# Plan: Fix Auth Middleware Dependency Antipattern

## Problem Statement

Infrastructure HTTP modules import from the auth feature module, violating clean architecture principles:

```
packages/backend/src/
├── infrastructure/
│   └── http/
│       └── handlers/
│           ├── middleware/
│           │   ├── createBearerTokenAuthenticationMiddleware.ts  → imports IAuthService
│           │   └── createCookieAuthenticationMiddleware.ts       → imports IAuthService
│           └── factory/
│               ├── HttpHandlerFactory.ts                         → imports createAuthService
│               └── actions/
│                   ├── createRoute.ts                            → imports IAuthService
│                   └── getMiddlewareForHandler.ts                → imports IAuthService
├── auth/                                                          ← Feature module
│   ├── domain/AuthService.ts
│   └── services/AuthService.ts
```

**Current Dependency Flow (Wrong):**
```
infrastructure/http → auth (feature)
```

**Desired Dependency Flow:**
```
app → auth (feature) → infrastructure
app → infrastructure
```

---

## Solution Overview

1. **Move auth middleware** from `infrastructure/http/handlers/middleware/` to `auth/middleware/`
2. **Update HttpRouteFactory** to accept middleware factories via dependency injection
3. **Create `createAuthMiddlewareFactories()`** in auth module that returns pre-configured middleware
4. **Update app-level handlers.manifest.ts** to wire middleware explicitly
5. **Remove auth imports** from all infrastructure HTTP code

---

## Design: Explicit Middleware Composition (Option A)

### Type Definitions

```typescript
// Infrastructure defines types (no auth knowledge)
export type MiddlewareFactory = (config: MiddlewareConfig) => IHttpMiddleware[];

export interface RouteMiddlewareConfig {
  api: MiddlewareFactory[];
  app: MiddlewareFactory[];
  public: MiddlewareFactory[];
}

export interface MiddlewareConfig {
  requiredPermissions?: Permission[];
}
```

### Auth Module Provides Middleware Factories

```typescript
// packages/backend/src/auth/middleware/createAuthMiddlewareFactories.ts
export function createAuthMiddlewareFactories(ctx) {
  const authService = createAuthService({ ... });

  return {
    bearerToken: (config) => [createBearerTokenAuthMiddleware({ auth: authService, ... }, config)],
    cookie: (config) => [createCookieAuthMiddleware({ auth: authService, ... }, config)],
    none: () => [],
  };
}
```

### App-Level Explicit Composition

```typescript
// apps/api/src/handlers.manifest.ts
const auth = createAuthMiddlewareFactories({ logger, appConfig });

const middlewareConfig: RouteMiddlewareConfig = {
  api: [auth.bearerToken],
  app: [auth.cookie],
  public: [],
};

const routeFactory = createHttpRouteFactory({ logger, appConfig, middlewareConfig });
```

---

## Implementation Phases

### Phase 1: Define Infrastructure Types

**Goal:** Define middleware types in infrastructure without any auth knowledge.

**Files to create:**
- [ ] `packages/backend/src/infrastructure/http/handlers/middleware/domain/MiddlewareConfig.ts`

**Changes:**
1. Create `MiddlewareFactory` type
2. Create `RouteMiddlewareConfig` interface
3. Create `MiddlewareConfig` interface
4. Export from infrastructure index

---

### Phase 2: Move Auth Middleware to Auth Module

**Goal:** Auth module owns all auth-related middleware.

**Files to move:**
- [ ] `infrastructure/http/handlers/middleware/createBearerTokenAuthenticationMiddleware.ts` → `auth/middleware/createBearerTokenAuthenticationMiddleware.ts`
- [ ] `infrastructure/http/handlers/middleware/createCookieAuthenticationMiddleware.ts` → `auth/middleware/createCookieAuthenticationMiddleware.ts`

**Files to create:**
- [ ] `packages/backend/src/auth/middleware/createAuthMiddlewareFactories.ts`
- [ ] `packages/backend/src/auth/middleware/index.ts`

**Files to delete:**
- [ ] `packages/backend/src/infrastructure/http/handlers/middleware/createBearerTokenAuthenticationMiddleware.ts`
- [ ] `packages/backend/src/infrastructure/http/handlers/middleware/createCookieAuthenticationMiddleware.ts`
- [ ] `packages/backend/src/infrastructure/http/handlers/factory/actions/getMiddlewareForHandler.ts`

**Changes:**
1. Move middleware files to auth module
2. Update imports in moved files to use `@backend/auth/...` paths
3. Create `createAuthMiddlewareFactories()` function
4. Export from `auth/index.ts`

---

### Phase 3: Update HttpRouteFactory to Accept Middleware Config

**Goal:** HttpRouteFactory receives middleware factories via dependency injection.

**Files to modify:**
- [ ] `packages/backend/src/infrastructure/http/handlers/factory/HttpHandlerFactory.ts`
- [ ] `packages/backend/src/infrastructure/http/handlers/factory/actions/createRoute.ts`

**Changes:**
1. Update `HttpRouteFactoryContext` to include `middlewareConfig: RouteMiddlewareConfig`
2. Remove `createAuthService` import and internal auth service creation
3. Update `createRoute()` to use middleware from config instead of `getMiddlewareForHandler()`
4. Remove `getMiddlewareForHandler.ts` (no longer needed)

---

### Phase 4: Update SharedHTTPHandler and StandardHTTPHandler

**Goal:** Handler base classes receive route factory via dependency injection.

**Files to modify:**
- [ ] `packages/backend/src/infrastructure/http/handlers/SharedHttpHandler.ts`
- [ ] `packages/backend/src/infrastructure/http/handlers/StandardHttpHandler.ts`

**Changes:**
1. Update context interface to accept `routeFactory: IHttpRouteFactory`
2. Remove internal `createHttpRouteFactory()` call
3. Use injected factory instead

---

### Phase 5: Update Feature Module Handlers

**Goal:** Feature handlers receive route factory from app-level wiring.

**Files to modify:**
- [ ] `packages/backend/src/users/handlers/http/UsersHttpHandler.ts`
- [ ] `packages/backend/src/tasks/handlers/http/TasksHttpHandler.ts`

**Changes:**
1. Update context interface to accept `routeFactory: IHttpRouteFactory`
2. Pass factory to base class / use directly

---

### Phase 6: Update App-Level Handlers Manifest

**Goal:** App wires middleware explicitly.

**Files to modify:**
- [ ] `apps/api/src/handlers.manifest.ts`

**Changes:**
1. Import `createAuthMiddlewareFactories` from `@autoflow/backend/auth`
2. Import `createHttpRouteFactory` from `@autoflow/backend`
3. Create middleware factories with auth
4. Configure `RouteMiddlewareConfig` explicitly
5. Create route factory with middleware config
6. Pass route factory to handler constructors

---

### Phase 7: Update Infrastructure Exports

**Goal:** Clean up infrastructure exports, remove auth-related exports.

**Files to modify:**
- [ ] `packages/backend/src/infrastructure/index.ts`
- [ ] `packages/backend/src/infrastructure/http/handlers/middleware/index.ts` (if exists)

**Changes:**
1. Remove middleware exports that moved to auth
2. Add new middleware type exports
3. Ensure `IHttpMiddleware` interface is exported

---

### Phase 8: Update Auth Module Exports

**Goal:** Auth module exports middleware factories.

**Files to modify:**
- [ ] `packages/backend/src/auth/index.ts`
- [ ] `packages/backend/package.json` (add `/auth` subpath export if needed)

**Changes:**
1. Export `createAuthMiddlewareFactories`
2. Export middleware types
3. Ensure subpath export works

---

### Phase 9: Update Tests

**Goal:** All tests pass with new architecture.

**Files to modify:**
- [ ] `packages/backend/src/infrastructure/http/handlers/factory/actions/__tests__/createRoute.test.ts`
- [ ] `packages/backend/src/infrastructure/http/handlers/factory/actions/__tests__/getMiddlewareForHandler.test.ts` → DELETE
- [ ] `packages/backend/src/infrastructure/http/handlers/middleware/__tests__/createBearerTokenAuthenticationMiddleware.test.ts` → MOVE to auth
- [ ] `packages/backend/src/infrastructure/http/handlers/middleware/__tests__/createCookieAuthenticationMiddleware.test.ts` → MOVE to auth
- [ ] `packages/backend/src/users/handlers/http/__tests__/UsersHttpHandler.integration.test.ts`
- [ ] `packages/backend/src/tasks/handlers/http/__tests__/TasksHttpHandler.integration.test.ts`

**Changes:**
1. Move middleware tests to auth module
2. Delete `getMiddlewareForHandler.test.ts`
3. Update remaining tests to use new patterns
4. Add tests for `createAuthMiddlewareFactories()`

---

### Phase 10: Cleanup and Verification

**Goal:** Verify everything works and clean up.

**Tasks:**
- [ ] Run `bun tsc --noEmit` - verify no TypeScript errors
- [ ] Run `make test` - verify all tests pass
- [ ] Remove empty directories
- [ ] Verify no remaining auth imports in infrastructure

**Verification commands:**
```bash
# Check for auth imports in infrastructure (should return nothing)
grep -r "@backend/auth" packages/backend/src/infrastructure --include="*.ts"

# TypeScript check
bun tsc --noEmit

# Run all tests
make test
```

---

## File Summary

### Files to Create
| File | Description |
|------|-------------|
| `infrastructure/http/handlers/middleware/domain/MiddlewareConfig.ts` | Middleware type definitions |
| `auth/middleware/createAuthMiddlewareFactories.ts` | Auth middleware factory creator |
| `auth/middleware/index.ts` | Auth middleware barrel export |

### Files to Move
| From | To |
|------|-----|
| `infrastructure/http/handlers/middleware/createBearerTokenAuthenticationMiddleware.ts` | `auth/middleware/createBearerTokenAuthenticationMiddleware.ts` |
| `infrastructure/http/handlers/middleware/createCookieAuthenticationMiddleware.ts` | `auth/middleware/createCookieAuthenticationMiddleware.ts` |
| `infrastructure/http/handlers/middleware/__tests__/createBearerTokenAuthenticationMiddleware.test.ts` | `auth/middleware/__tests__/createBearerTokenAuthenticationMiddleware.test.ts` |
| `infrastructure/http/handlers/middleware/__tests__/createCookieAuthenticationMiddleware.test.ts` | `auth/middleware/__tests__/createCookieAuthenticationMiddleware.test.ts` |

### Files to Delete
| File | Reason |
|------|--------|
| `infrastructure/http/handlers/factory/actions/getMiddlewareForHandler.ts` | No longer needed - middleware comes from config |
| `infrastructure/http/handlers/factory/actions/__tests__/getMiddlewareForHandler.test.ts` | Test for deleted file |

### Files to Modify
| File | Changes |
|------|---------|
| `infrastructure/http/handlers/factory/HttpHandlerFactory.ts` | Accept middleware config, remove auth |
| `infrastructure/http/handlers/factory/actions/createRoute.ts` | Use middleware from config, remove auth |
| `infrastructure/http/handlers/SharedHttpHandler.ts` | Accept route factory via DI |
| `infrastructure/http/handlers/StandardHttpHandler.ts` | Accept route factory via DI |
| `users/handlers/http/UsersHttpHandler.ts` | Pass route factory |
| `tasks/handlers/http/TasksHttpHandler.ts` | Pass route factory |
| `apps/api/src/handlers.manifest.ts` | Wire middleware explicitly |
| `infrastructure/index.ts` | Update exports |
| `auth/index.ts` | Add middleware exports |

---

## Final Architecture

```
packages/backend/src/
├── infrastructure/
│   └── http/
│       └── handlers/
│           ├── middleware/
│           │   └── domain/
│           │       └── MiddlewareConfig.ts      ← Types only (no auth knowledge)
│           └── factory/
│               ├── HttpHandlerFactory.ts        ← Accepts middleware config
│               └── actions/
│                   └── createRoute.ts           ← Uses middleware from config
├── auth/
│   ├── middleware/                              ← Auth owns its middleware
│   │   ├── createBearerTokenAuthenticationMiddleware.ts
│   │   ├── createCookieAuthenticationMiddleware.ts
│   │   ├── createAuthMiddlewareFactories.ts    ← Factory creator
│   │   └── index.ts
│   ├── domain/
│   │   └── AuthService.ts
│   └── services/
│       └── AuthService.ts

apps/api/src/
└── handlers.manifest.ts                         ← Wires auth middleware explicitly
```

**Dependency Flow (Correct):**
```
apps/api/handlers.manifest.ts
    ├──► auth/middleware (createAuthMiddlewareFactories)
    ├──► infrastructure/http (createHttpRouteFactory, types)
    └──► users/handlers, tasks/handlers (feature handlers)

auth/middleware
    ├──► auth/services (AuthService)
    └──► infrastructure/http (IHttpMiddleware interface)

infrastructure/http
    └──► (no feature imports!)
```

---

## Success Criteria

1. **No auth imports in infrastructure:**
   ```bash
   grep -r "@backend/auth" packages/backend/src/infrastructure --include="*.ts"
   # Should return nothing
   ```

2. **TypeScript compiles:** `bun tsc --noEmit` passes

3. **All tests pass:** `make test` shows 557+ tests passing

4. **Feature handlers unchanged:** UsersHttpHandler and TasksHttpHandler still just specify `type: 'api'` and `permissions` - no auth knowledge

5. **App-level wiring is explicit:** Looking at `handlers.manifest.ts` clearly shows what middleware runs on each route type
