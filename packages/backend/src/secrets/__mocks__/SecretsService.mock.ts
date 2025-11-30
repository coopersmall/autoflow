import { mock } from 'bun:test';
import { getMockedStandardService } from '@backend/__mocks__/StandardService.mock';
import type { ISecretsService } from '@backend/secrets';
import type { Secret, SecretId } from '@core/domain/secrets/Secret';
import type { ExtractMockMethods } from '@core/types';

export function getMockedSecretsService(): ExtractMockMethods<ISecretsService> {
  return {
    ...getMockedStandardService<SecretId, Secret>(),
    reveal: mock(),
    store: mock(),
  };
}
