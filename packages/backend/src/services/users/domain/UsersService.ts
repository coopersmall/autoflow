import type { ISharedService } from '@backend/services/shared/SharedService';
import type { User, UserId } from '@core/domain/user/user';

export type IUsersService = ISharedService<UserId, User>;
