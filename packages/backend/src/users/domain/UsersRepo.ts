import type { ISharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { User, UserId } from '@core/domain/user/user';

export type IUsersRepo = ISharedRepo<UserId, User>;
