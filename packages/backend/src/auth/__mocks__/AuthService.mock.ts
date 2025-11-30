import { mock } from 'bun:test';
import type { IAuthService } from '@backend/auth/domain/AuthService';
import type { ExtractMockMethods } from '@core/types';

export function getMockedAuthService(): ExtractMockMethods<IAuthService> {
  return {
    authenticate: mock(),
    createClaim: mock(),
    validateClaim: mock(),
    getUserId: mock(),
    getPermissions: mock(),
  };
}
