import { join } from 'node:path';
import { createAppConfigurationService } from '@autoflow/backend';
import { serve } from 'bun';

const appConfig = createAppConfigurationService();
const isProduction = appConfig.environment === 'production';

// Import the index.html from the web package
const indexHtml = Bun.file(
  join(import.meta.dir, '../../../packages/web/src/app/index.html'),
);

const _server = serve({
  port: 3001,

  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Handle static files first
    if (
      pathname.startsWith('/images/') ||
      pathname.startsWith('/static/') ||
      pathname.startsWith('/assets/')
    ) {
      const filePath = join(
        import.meta.dir,
        '../../../packages/web/public',
        pathname,
      );
      const file = Bun.file(filePath);

      if (await file.exists()) {
        return new Response(file);
      }
      // If file doesn't exist, return 404
      return new Response('File not found', { status: 404 });
    }

    // Serve index.html for all other routes (SPA routing)
    return new Response(indexHtml);
  },

  websocket: {
    message(ws, message) {
      ws.send(message);
    },
    open(ws) {
      ws.send('Welcome to the WebSocket server!');
    },
    close() {
      // Connection closed
    },
  },

  development: !isProduction && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

// if (!isProduction) {}
