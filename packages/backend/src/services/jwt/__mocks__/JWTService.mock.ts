import { mock } from 'bun:test';
import type { JWTService } from '@backend/services/jwt/JWTService';
import type { ExtractMockMethods } from '@core/types';

export function getMockedJWTService(): ExtractMockMethods<JWTService> {
  return {
    create: mock(),
    encode: mock(),
    decode: mock(),
    validate: mock(),
    generateKeys: mock(),
    getUserId: mock(),
    getPermissions: mock(),
    createAndEncode: mock(),
    decodeAndValidate: mock(),
  };
}
