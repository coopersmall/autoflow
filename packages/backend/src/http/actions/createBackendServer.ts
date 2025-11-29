import type { IHttpServer } from '@backend/http/domain/HttpServer';
import { createServer } from '@backend/http/server/HttpServer';
import { getLogger } from '@backend/logger/Logger';
import { createServiceFactory } from '@backend/services/ServiceFactory';
import { createHandlers } from './createHandlers';

export function createBackendServer(
  actions = {
    getLogger,
    createServer,
    createServiceFactory,
    createHandlers,
  },
): IHttpServer {
  const logger = actions.getLogger();
  const serviceFactory = actions.createServiceFactory({
    logger,
  });
  const handlers = actions.createHandlers(logger, serviceFactory);
  const server = actions.createServer({
    logger,
    routeHandlers: handlers,
  });

  return server;
}
