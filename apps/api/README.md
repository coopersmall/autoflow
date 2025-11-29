# @autoflow/api

HTTP API server entry point.

## Purpose

This is a deployable application that starts the backend HTTP server. It imports and configures the server from `@autoflow/backend`.

## What It Does

1. Creates the backend server using `createBackendServer()`
2. Starts listening on port 3000
3. Handles HTTP requests via the backend's route handlers

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      apps/api                               │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    index.ts                          │   │
│   │                                                      │   │
│   │   import { createBackendServer } from '@autoflow/backend'│
│   │   server.start({ port: 3000 })                       │   │
│   └─────────────────────────────────────────────────────┘   │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   @autoflow/backend                         │
│                                                             │
│   HTTP Handlers → Services → Repos → PostgreSQL            │
│                           → Cache → Redis                  │
└─────────────────────────────────────────────────────────────┘
```

## Running

```bash
# Development (with hot reload)
make dev-api
# or
bun run --filter '@autoflow/api' dev

# Production
make start-api
# or
bun run --filter '@autoflow/api' start
```

## Configuration

The server reads configuration from environment variables via `@autoflow/backend`'s `AppConfigurationService`:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `JWT_PUBLIC_KEY` | JWT verification key | - |
| `JWT_PRIVATE_KEY` | JWT signing key | - |

## Directory Structure

```
apps/api/
├── src/
│   └── index.ts      # Entry point
├── package.json      # Package configuration
└── tsconfig.json     # TypeScript config
```

## Dependencies

- `@autoflow/backend` - Server implementation, handlers, services

## Why a Separate App?

Separating the entry point from the backend package allows:

1. **Independent deployment** - Deploy API separately from workers
2. **Configuration isolation** - Different env vars per deployment
3. **Clear boundaries** - Entry points are thin wrappers
4. **Scalability** - Run multiple API instances behind a load balancer
