import {
  createAppConfigurationService,
  createServer,
  getLogger,
} from '@autoflow/backend';
import { createHandlers } from './handlers.manifest.ts';

const PORT = 3000 as const;

function run(port: number) {
  // Create dependencies
  const logger = getLogger();
  const appConfig = createAppConfigurationService();

  // Create route handlers
  const handlers = createHandlers({ logger, appConfig });

  // Create and start server
  const server = createServer({
    logger,
    routeHandlers: handlers,
  });

  server.start({ port });
}

function main() {
  run(PORT);
}

main();
