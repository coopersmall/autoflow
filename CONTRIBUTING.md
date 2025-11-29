# Contributing to Autoflow

## Code Standards

### Forbidden Patterns

1. **No throwing errors** - Use `Result` types from [neverthrow](https://github.com/supermacro/neverthrow)
2. **No `any` type** - Use `unknown`, `Record<string, unknown>`, or generics
3. **No type assertions** - Use validation functions with Zod schemas
4. **No `console.log`** - Use the logger (`logger.debug()`, `logger.info()`, `logger.error()`)
5. **No direct `process.env`** - Use `AppConfigurationService`
6. **No relative imports going up** - Use path aliases (`@core/*`, `@backend/*`, etc.)

→ **For complete details**, see [Code Style Guide](./docs/code-style.md)

## Architecture Overview

Autoflow follows functional programming patterns with strong type safety:

### Core Principles

- **Result Types**: Use `ok()` and `err()` instead of throwing exceptions
- **Factory Functions**: Create instances via `createX()` functions, not `new`
- **Context Objects**: Pass dependencies via structured context parameters
- **Action Pattern**: Pure business logic in `actions/` folders
- **Service Patterns**: `SharedService` for global data, `StandardService` for user-scoped data

→ **For in-depth patterns**, see [Architecture Guide](./docs/architecture.md)

## Development Workflow

### Adding a New Feature

1. **Model your domain** → [Domain Modeling Guide](./docs/domain-modeling.md)
   - Create Zod schemas with branded types
   - Define validation functions
   - Version your schemas

2. **Create services** → [Services Guide](./docs/services.md)
   - Implement `SharedService` or `StandardService`
   - Add repos and cache layers
   - Register in `ServiceFactory`

3. **Add HTTP endpoints** → [HTTP Handlers Guide](./docs/http-handlers.md)
   - Create request handlers
   - Validate inputs
   - Return typed responses

4. **Add background tasks** → [Background Tasks Guide](./docs/background-tasks.md)
   - Define tasks with `defineTask()`
   - Register in `tasks.config.ts`
   - Schedule from services

5. **Write tests** → [Testing Guide](./docs/testing.md)
   - Unit test actions and validation
   - Integration test services
   - Use type-safe mocks

### Path Aliases

Use these aliases for imports:

| Alias | Maps To | Usage |
|-------|---------|-------|
| `@core/*` | `packages/core/src/*` | Domain models, validation |
| `@backend/*` | `packages/backend/src/*` | Services, repos, handlers |
| `@client/*` | `packages/client/src/*` | HTTP client |
| `@web/*` | `packages/web/src/*` | Web UI components |

## Testing

### Test Best Practices

1. Check Result types with `result.isOk()` before accessing `.value`
2. Clear mocks in `beforeEach` with `jest.clearAllMocks()`
3. Use factory functions like `UserId()` to create test IDs
4. Isolate tests - each test should be independent

→ **For detailed testing patterns**, see [Testing Guide](./docs/testing.md)

## Documentation Index

### Getting Started
- [Setup Guide](./docs/setup.md) - Environment setup and tooling

### Core Concepts
- [Code Style Guide](./docs/code-style.md) - Linting rules and patterns
- [Architecture Guide](./docs/architecture.md) - Architectural patterns and principles
- [Domain Modeling Guide](./docs/domain-modeling.md) - Zod schemas and validation

### Building Features
- [Services Guide](./docs/services.md) - Creating services and business logic
- [HTTP Handlers Guide](./docs/http-handlers.md) - API endpoints and routes
- [Background Tasks Guide](./docs/background-tasks.md) - Queue system and async processing
- [Database Guide](./docs/database.md) - Database operations and migrations

### Quality
- [Testing Guide](./docs/testing.md) - Unit and integration testing

## Project Structure

```
autoflow/
├── apps/
│   ├── api/          # API server
│   ├── worker/       # Background worker
│   └── web/          # Web frontend
├── packages/
│   ├── backend/      # Services, repos, handlers
│   ├── client/       # HTTP client
│   ├── core/         # Domain models
│   └── web/          # Web components
├── docs/             # Documentation
├── biome/            # Custom linter rules
└── Makefile          # Development commands
```
