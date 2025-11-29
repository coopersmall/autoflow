# Autoflow

A TypeScript monorepo built with Bun workspaces for building full-stack applications with background task processing.

## Architecture

```
autoflow/
├── packages/                 # Shared libraries
│   ├── core/                 # Domain types, errors, validation
│   ├── backend/              # Services, repos, cache, HTTP, tasks
│   ├── client/               # HTTP client, React hooks
│   └── web/                  # React UI components
│
├── apps/                     # Deployable applications
│   ├── api/                  # HTTP API server (port 3000)
│   ├── worker/               # Background task workers
│   └── web/                  # Web server for frontend (port 3001)
```

## Quick Start

```bash
# Install dependencies
bun install

# Start development servers
make dev-api      # API server on port 3000
make dev-worker   # Background workers
make dev-web      # Web server on port 3001

# Or start all at once
make dev-all
```

## Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start API server (default) |
| `make dev-api` | Start API server |
| `make dev-worker` | Start background workers |
| `make dev-web` | Start web server |
| `make dev-all` | Start all services |
| `make test` | Run all tests |
| `make test-integration` | Run integration tests |
| `make lint` | Run linter |
| `make tsc` | Type check |
| `make db-push` | Push schema to database |
| `make db-generate` | Generate migrations |
| `make db-migrate` | Apply migrations |

## Packages

### [@autoflow/core](./packages/core)

Shared domain types, error classes, and validation utilities. Zero external dependencies (except Zod). All other packages depend on this.

### [@autoflow/backend](./packages/backend)

Server-side business logic including:
- **Services** - Business logic with dependency injection
- **Repositories** - Data access layer with PostgreSQL
- **Cache** - Redis caching with adapter pattern
- **HTTP** - Request handlers and middleware
- **Tasks** - Background job processing with BullMQ

### [@autoflow/client](./packages/client)

Browser-side utilities:
- Type-safe HTTP client for API communication
- React hooks for authentication and data fetching
- Streaming utilities for AI responses

### [@autoflow/web](./packages/web)

React UI components and frontend application code.

## Apps

### [api](./apps/api)

HTTP API server entry point. Starts the backend server on port 3000.

### [worker](./apps/worker)

Background task worker entry point. Processes jobs from BullMQ queues.

### [web](./apps/web)

Web server for serving the React frontend on port 3001.

## Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript |
| Frontend | React 19, Radix UI, Tailwind CSS |
| Backend | Bun HTTP server |
| Database | PostgreSQL with [Drizzle ORM](https://orm.drizzle.team) |
| Cache | Redis with [ioredis](https://github.com/redis/ioredis) |
| Task Queue | [BullMQ](https://docs.bullmq.io) |
| Validation | [Zod](https://zod.dev) |
| Error Handling | [neverthrow](https://github.com/supermacro/neverthrow) (Result types) |
