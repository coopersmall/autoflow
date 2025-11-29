import type { ILogger } from '@backend/logger/Logger';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import { SharedService } from '@backend/services/shared/SharedService';
import { type User, UserId } from '@core/domain/user/user';
import { createUsersCache } from './cache/UsersCache';
import type { IUsersService } from './domain/UsersService';
import { createUsersRepo } from './repos/UsersRepo';

export { createUsersService };
export type { IUsersService };

function createUsersService(ctx: UsersServiceContext): UsersService {
  return new UsersService(ctx);
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
