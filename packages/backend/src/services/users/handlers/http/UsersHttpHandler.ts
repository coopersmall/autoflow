import type { IHttpHandler } from '@backend/http/domain/HttpHandler';
import { SharedHTTPHandler } from '@backend/http/handlers/SharedHttpHandler';
import type { ILogger } from '@backend/logger/Logger';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { IUsersService } from '@backend/services/users/UsersService';
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
  return new UsersHttpHandlers(context);
}

interface UsersHttpHandlersContext {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  service: () => IUsersService;
}

class UsersHttpHandlers
  extends SharedHTTPHandler<UserId, User>
  implements IHttpHandler
{
  constructor(readonly ctx: UsersHttpHandlersContext) {
    super({
      ...ctx,
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
