import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { SharedService } from '@backend/infrastructure/services/SharedService';
import { createUsersCache } from '@backend/users/cache/UsersCache';
import type { IUsersService } from '@backend/users/domain/UsersService';
import { createUsersRepo } from '@backend/users/repos/UsersRepo';
import { type User, UserId } from '@core/domain/user/user';

export { createUsersService };

function createUsersService(ctx: UsersServiceContext): IUsersService {
  return Object.freeze(new UsersService(ctx));
}

interface UsersServiceContext {
  appConfig: () => IAppConfigurationService;
  logger: ILogger;
}

class UsersService
  extends SharedService<UserId, User>
  implements IUsersService
{
  constructor(
    readonly context: UsersServiceContext,
    private readonly dependencies = {
      createUsersRepo,
      createUsersCache,
    },
  ) {
    const appConfig = context.appConfig();

    super('users', {
      ...context,
      repo: () => this.dependencies.createUsersRepo({ appConfig }),
      cache: () =>
        this.dependencies.createUsersCache({
          logger: context.logger,
          appConfig,
        }),
      newId: UserId,
    });
  }
}
