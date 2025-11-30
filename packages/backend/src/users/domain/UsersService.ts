import type { ISharedService } from '@backend/infrastructure/services/SharedService';
import type { User, UserId } from '@core/domain/user/user';

export type IUsersService = Readonly<ISharedService<UserId, User>>;
