import { mock } from 'bun:test';
import type { IUsersService } from '@backend/users/domain/UsersService';
import type { ExtractMockMethods } from '@core/types';

export function getMockedUsersService(): ExtractMockMethods<IUsersService> {
  return {
    serviceName: 'users',
    get: mock(),
    all: mock(),
    create: mock(),
    update: mock(),
    delete: mock(),
  };
}
