import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { SharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { IUsersRepo } from '@backend/users/domain/UsersRepo';
import type { User, UserId } from '@core/domain/user/user';
import { validUser } from '@core/domain/user/validation/validUser';

export function createUsersRepo({
  appConfig,
}: {
  appConfig: IAppConfigurationService;
}): IUsersRepo {
  return new UsersRepo(appConfig);
}

class UsersRepo extends SharedRepo<UserId, User> implements IUsersRepo {
  constructor(appConfig: IAppConfigurationService) {
    super(appConfig, 'users', validUser);
  }
}
