import { SharedRepo } from '@backend/repos/SharedRepo';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { IUsersRepo } from '@backend/services/users/domain/UsersRepo';
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
