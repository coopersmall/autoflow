# Setup Guide

This guide will help you set up the Autoflow development environment from scratch.

## Prerequisites

Before you begin, ensure you have the following installed:

- **[Bun](https://bun.sh)** v1.0 or later - JavaScript runtime and package manager
- **[Docker](https://www.docker.com/)** - For running databases and services in containers
- **Git** - Version control
- **Node.js** v18+ (optional, but recommended for editor tooling)

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd autoflow
```

### 2. Install Dependencies

```bash
make deps
```

This command will:
- Create a symlink from `CONTRIBUTING.md` to `AGENTS.md` for AI coding assistants
- Install all workspace dependencies using Bun

### 3. Environment Configuration

Create a `.env` file in the root directory (or copy from `.env.example` if available):

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/autoflow

# Redis Cache
REDIS_URL=redis://localhost:6379

# Application
NODE_ENV=development
PORT=3000
WORKER_PORT=3002
WEB_PORT=3001

# Site URL
SITE=http://localhost:3000

# JWT Keys (generate new ones for production)
JWT_PUBLIC_KEY=<your-public-key>
JWT_PRIVATE_KEY=<your-private-key>
```

### 4. Start Docker Services

```bash
docker compose up -d
```

This will start:
- PostgreSQL database
- Redis cache
- Any other required services

### 5. Database Setup

Generate and apply database migrations:

```bash
# Generate migrations from schema
make db-generate

# Apply migrations to database
make db-migrate

# Or push schema directly (development only)
make db-push
```

## Development Workflow

### Running Development Servers

Autoflow is a monorepo with three main applications:

#### API Server (Port 3000)

The main backend API server:

```bash
make dev-api
```

This starts the HTTP server with hot reloading enabled.

#### Background Worker

Processes background tasks and jobs:

```bash
make dev-worker
```

#### Web Server (Port 3001)

The frontend web application:

```bash
make dev-web
```

#### Run All Services

To run all services simultaneously:

```bash
make dev-all
```

This uses Bun's built-in concurrency to run all services in parallel.

### Default Development Command

```bash
make dev
```

By default, `make dev` starts the API server. Adjust this in the Makefile if needed.

## Project Structure

```
autoflow/
├── apps/
│   ├── api/          # API server application
│   ├── worker/       # Background worker application
│   └── web/          # Web frontend application
├── packages/
│   ├── backend/      # Backend services, repos, handlers
│   ├── client/       # HTTP client for API
│   ├── core/         # Shared domain models and types
│   └── web/          # Web components and utilities
├── docs/             # Documentation (you are here!)
├── biome/            # Custom Biome linter rules
├── Makefile          # Development commands
└── docker-compose.yml # Docker services
```

## Verification

After setup, verify everything is working:

### 1. Check Type Safety

```bash
make tsc
```

Should complete with no errors.

### 2. Run Linter

```bash
make lint
```

Should show no linting errors.

### 3. Run Tests

```bash
make test
```

All unit tests should pass.

### 4. Run Integration Tests

```bash
make test-integration
```

This will:
- Start test Docker containers
- Run integration tests
- Stop test containers

## Common Issues

### Port Already in Use

If you get port conflicts, check what's running:

```bash
lsof -i :3000  # API port
lsof -i :3001  # Web port
lsof -i :3002  # Worker port
```

Kill the process or change the port in your `.env` file.

### Database Connection Issues

Ensure Docker services are running:

```bash
docker compose ps
```

Check database logs:

```bash
docker compose logs postgres
```

### Bun Not Found

Install Bun globally:

```bash
curl -fsSL https://bun.sh/install | bash
```

Then restart your shell.

### Module Resolution Errors

If you see path alias errors (`@core/*`, `@backend/*`, etc.), ensure:
1. All dependencies are installed: `make deps`
2. TypeScript is using the workspace tsconfig: check your editor settings

## IDE Setup

### VSCode

Recommended extensions:
- **Biome** - For linting and formatting
- **TypeScript and JavaScript Language Features** (built-in)

Add to `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## Next Steps

Now that your environment is set up:

1. Read the [Code Style Guide](./code-style.md) to understand our linting rules
2. Review [Architecture Patterns](./architecture.md) to understand our code structure
3. Check out [Testing Guide](./testing.md) to learn our testing approach
4. Start building! See [Services Guide](./services.md) to create your first feature

## Getting Help

If you encounter issues not covered here:
1. Check existing GitHub issues
2. Review the detailed guides in `/docs`
3. Ask in the team chat or create a new issue
