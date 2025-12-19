import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { SharedService } from '@backend/infrastructure/services/SharedService';
import { createUsersCache } from '@backend/users/cache/UsersCache';
import type { IUsersService } from '@backend/users/domain/UsersService';
import { createUsersRepo } from '@backend/users/repos/UsersRepo';
import { type User, UserId } from '@core/domain/user/user';

export { createUsersService };

function createUsersService(config: UsersServiceConfig): IUsersService {
  return Object.freeze(new UsersService(config));
}

interface UsersServiceConfig {
  appConfig: IAppConfigurationService;
  logger: ILogger;
}

interface UsersServiceDependencies {
  createUsersRepo: typeof createUsersRepo;
  createUsersCache: typeof createUsersCache;
}

class UsersService
  extends SharedService<UserId, User>
  implements IUsersService
{
  constructor(
    private readonly usersConfig: UsersServiceConfig,
    private readonly dependencies: UsersServiceDependencies = {
      createUsersRepo,
      createUsersCache,
    },
  ) {
    const appConfig = usersConfig.appConfig;

    super('users', {
      ...usersConfig,
      repo: () => this.dependencies.createUsersRepo({ appConfig }),
      cache: () =>
        this.dependencies.createUsersCache({
          logger: usersConfig.logger,
          appConfig,
        }),
      newId: UserId,
    });
  }
}
