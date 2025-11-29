# @autoflow/web-server

Web server for serving the React frontend.

## Purpose

This is a deployable application that serves the frontend React application. It handles static files and SPA routing.

## What It Does

1. Serves the `index.html` from `@autoflow/web`
2. Serves static assets (images, CSS, JS)
3. Handles SPA routing (returns index.html for all routes)
4. Provides WebSocket support
5. Enables hot module reloading in development

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    apps/web                                 │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    index.ts                          │   │
│   │                                                      │   │
│   │   Bun.serve({                                       │   │
│   │     port: 3001,                                     │   │
│   │     fetch: handleRequest,                           │   │
│   │     development: { hmr: true }                      │   │
│   │   })                                                │   │
│   └─────────────────────────────────────────────────────┘   │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
      ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
      │ index.html  │ │   /images/  │ │  /assets/   │
      │ (SPA entry) │ │   /static/  │ │             │
      └─────────────┘ └─────────────┘ └─────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    @autoflow/web                            │
│                                                             │
│   React components, styles, frontend application           │
└─────────────────────────────────────────────────────────────┘
```

## Running

```bash
# Development (with HMR)
make dev-web
# or
bun run --filter '@autoflow/web-server' dev

# Production
make start-web
# or
bun run --filter '@autoflow/web-server' start
```

## Request Handling

| Path | Handler |
|------|---------|
| `/images/*`, `/static/*`, `/assets/*` | Serve static files |
| `/*` (all other routes) | Return `index.html` (SPA routing) |

## Development Mode

In development, the server enables:

- **Hot Module Reloading (HMR)** - Changes reflect instantly
- **Console forwarding** - Browser console logs appear in terminal
- **Source maps** - Debug original TypeScript

## Production Mode

In production:

- HMR disabled
- Optimized static file serving
- No development overhead

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | development |

Port is hardcoded to 3001 to avoid conflicts with the API server (3000).

## Directory Structure

```
apps/web/
├── src/
│   └── index.ts      # Entry point (Bun server)
├── package.json      # Package configuration
└── tsconfig.json     # TypeScript config
```

## Dependencies

- `@autoflow/backend` - For AppConfigurationService
- `@autoflow/web` - Frontend application (indirectly, via file paths)

## Why a Separate App?

Separating the web server allows:

1. **Independent deployment** - Deploy frontend separately from API
2. **CDN-ready** - Can be replaced with static hosting + CDN
3. **Different scaling** - Frontend and API have different needs
4. **Development flexibility** - HMR without affecting API

## Relationship to @autoflow/web

This app (`apps/web`) is the **server** that serves the frontend.
The package (`packages/web`) contains the **React application**.

```
apps/web (server) → serves → packages/web (React app)
```
