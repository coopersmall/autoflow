# @autoflow/worker

Background task worker entry point.

## Purpose

This is a deployable application that processes background jobs from BullMQ queues. It starts a worker for each task defined in the system.

## What It Does

1. Loads all task definitions from `@autoflow/backend`
2. Creates a `TaskWorker` for each task
3. Starts all workers to process jobs from their queues
4. Handles graceful shutdown on SIGTERM/SIGINT

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     apps/worker                             │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    index.ts                          │   │
│   │                                                      │   │
│   │   for each task in tasks.config:                    │   │
│   │     createTaskWorker({ task }).start()              │   │
│   └─────────────────────────────────────────────────────┘   │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
      ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
      │  Worker 1   │ │  Worker 2   │ │  Worker N   │
      │ (emails)    │ │ (reports)   │ │ (...)       │
      └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
             │               │               │
             └───────────────┼───────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Redis (BullMQ)                          │
│                                                             │
│   Queue: emails    Queue: reports    Queue: ...            │
└─────────────────────────────────────────────────────────────┘
```

## Running

```bash
# Development (with hot reload)
make dev-worker
# or
bun run --filter '@autoflow/worker' dev

# Production
make start-worker
# or
bun run --filter '@autoflow/worker' start
```

## How Workers Process Tasks

1. **Pick up job** - Worker pulls a job from its BullMQ queue
2. **Update status** - Mark task as "active" in PostgreSQL
3. **Execute handler** - Run the task's handler function
4. **Record result** - Update PostgreSQL with success/failure
5. **Retry on failure** - BullMQ handles retries up to `maxAttempts`

```
Job in Queue → Worker picks up → Handler executes → Result recorded
                     │                                    │
                     ▼                                    ▼
              PostgreSQL: active              PostgreSQL: completed/failed
```

## Graceful Shutdown

When receiving SIGTERM or SIGINT:

1. Stop accepting new jobs
2. Wait for current jobs to complete
3. Close connections
4. Exit cleanly

```typescript
process.on('SIGTERM', async () => {
  await Promise.all(workers.map(w => w.stop()));
  process.exit(0);
});
```

## Adding New Tasks

1. Define the task in the appropriate service using `defineTask()`
2. Add it to `tasks.config.ts` in `@autoflow/backend`
3. Restart the worker

```typescript
// In tasks.config.ts
import { sendWelcomeEmailTask } from './services/users/tasks';

export const tasks = [
  sendWelcomeEmailTask,
  // ... other tasks
];
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | development |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis/BullMQ connection string | - |

## Directory Structure

```
apps/worker/
├── src/
│   └── index.ts      # Entry point
├── package.json      # Package configuration
└── tsconfig.json     # TypeScript config
```

## Dependencies

- `@autoflow/backend` - Task definitions, worker implementation

## Why a Separate App?

Separating workers from the API server allows:

1. **Independent scaling** - Scale workers based on queue depth
2. **Isolation** - Worker crashes don't affect API
3. **Resource allocation** - Different CPU/memory per workload
4. **Deployment flexibility** - Deploy to different infrastructure
