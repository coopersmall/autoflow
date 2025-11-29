import { SharedCache } from '@backend/cache/SharedCache';
import type { ILogger } from '@backend/logger/Logger';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { IUsersCache } from '@backend/services/users/domain/UsersCache';
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
