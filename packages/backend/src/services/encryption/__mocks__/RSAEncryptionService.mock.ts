import { mock } from 'bun:test';
import type { RSAEncryptionService } from '@backend/services/encryption/RSAEncryptionService';
import type { ExtractMockMethods } from '@core/types';

export function getMockedRSAEncryptionService(): ExtractMockMethods<RSAEncryptionService> {
  return {
    generateSalt: mock(),
    encrypt: mock(),
    decrypt: mock(),
  };
}
