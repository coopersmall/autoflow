import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { IHttpHandler } from '@backend/infrastructure/http/domain/HttpHandler';
import type { IHttpRouteFactory } from '@backend/infrastructure/http/handlers/domain/HttpRouteFactory';
import { SharedHTTPHandler } from '@backend/infrastructure/http/handlers/SharedHttpHandler';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { createUsersService, type IUsersService } from '@backend/users';
import type { User, UserId } from '@core/domain/user/user';
import {
  validPartialUser,
  validUpdateUser,
  validUser,
  validUserId,
} from '@core/domain/user/validation/validUser';

export function createAPIUserHandlers(
  context: UsersHttpHandlersContext,
): IHttpHandler {
  return Object.freeze(new UsersHttpHandlers(context));
}

interface UsersHttpHandlersContext {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  routeFactory: IHttpRouteFactory;
}

interface UsersHttpHandlersDependencies {
  createUsersService: typeof createUsersService;
}

class UsersHttpHandlers
  extends SharedHTTPHandler<UserId, User>
  implements IHttpHandler
{
  constructor(
    private readonly ctx: UsersHttpHandlersContext,
    private readonly dependencies: UsersHttpHandlersDependencies = {
      createUsersService,
    },
  ) {
    const usersService: IUsersService = dependencies.createUsersService({
      logger: ctx.logger,
      appConfig: ctx.appConfig,
    });

    super({
      ...ctx,
      service: () => usersService,
      validators: {
        id: validUserId,
        item: validUser,
        partial: validPartialUser,
        update: validUpdateUser,
      },
    });
  }

  routes() {
    return super.routes({
      type: 'api',
      readPermissions: ['admin', 'read:users'],
      writePermissions: ['admin', 'write:users'],
    });
  }
}
