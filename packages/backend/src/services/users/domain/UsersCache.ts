import type { ISharedCache } from '@backend/cache/SharedCache';
import type { User, UserId } from '@core/domain/user/user';

export type IUsersCache = ISharedCache<UserId, User>;
