import { mock } from 'bun:test';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { ExtractMockMethods } from '@core/types';

export function getMockedEncryptionService(): ExtractMockMethods<IEncryptionService> {
  return {
    encryptRSA: mock(),
    decryptRSA: mock(),
    generateSalt: mock(),
    generateKeyPair: mock(),
    encodeJWT: mock(),
    decodeJWT: mock(),
  };
}
