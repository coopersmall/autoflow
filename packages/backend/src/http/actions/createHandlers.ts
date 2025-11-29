import type { IHttpHandler } from '@backend/http/domain/HttpHandler';
import type { ILogger } from '@backend/logger/Logger';
import type { IServiceFactory } from '@backend/services/ServiceFactory';
import { createAPIUserHandlers } from '@backend/services/users/handlers/http/UsersHttpHandler';

export function createHandlers(
  logger: ILogger,
  serviceFactory: IServiceFactory,
): IHttpHandler[] {
  const appConfig = serviceFactory.getService('appConfig')();
  return [
    createAPIUserHandlers({
      logger,
      appConfig,
      service: serviceFactory.getService('users'),
    }),
  ];
}
