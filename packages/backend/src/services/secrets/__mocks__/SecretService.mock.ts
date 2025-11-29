import { mock } from 'bun:test';
import { getMockedStandardService } from '@backend/services/__mocks__/StandardService.mock';
import type { ISecretsService } from '@backend/services/secrets/SecretsService';
import type { Secret, SecretId } from '@core/domain/secrets/Secret';
import type { ExtractMockMethods } from '@core/types';

export function getMockedSecretService(): ExtractMockMethods<ISecretsService> {
  return {
    ...getMockedStandardService<SecretId, Secret>(),
    reveal: mock(),
    store: mock(),
  };
}
