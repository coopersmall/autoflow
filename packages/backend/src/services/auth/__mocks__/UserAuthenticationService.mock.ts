import { mock } from 'bun:test';
import type { IUserAuthenticationService } from '@backend/services/auth/UserAuthenticationService';
import type { ExtractMockMethods } from '@core/types';

export function getMockedUserAuthenticationService(): ExtractMockMethods<IUserAuthenticationService> {
  return {
    authenticate: mock(),
  };
}
