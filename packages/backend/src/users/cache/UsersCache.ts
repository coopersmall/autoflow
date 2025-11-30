import { SharedCache } from '@backend/infrastructure/cache/SharedCache';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IUsersCache } from '@backend/users/domain/UsersCache';
import type { User, UserId } from '@core/domain/user/user';
import { validUser } from '@core/domain/user/validation/validUser';

export function createUsersCache({
  logger,
  appConfig,
}: {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}): IUsersCache {
  return new UsersCache(logger, appConfig);
}

class UsersCache extends SharedCache<UserId, User> implements IUsersCache {
  constructor(
    readonly logger: ILogger,
    readonly appConfig: IAppConfigurationService,
  ) {
    super('users', {
      appConfig,
      logger,
      validator: validUser,
    });
  }
}
