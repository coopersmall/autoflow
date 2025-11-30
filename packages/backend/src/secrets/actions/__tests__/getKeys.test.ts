import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { getKeys } from '@backend/secrets/actions/getKeys';
import { CorrelationId } from '@core/domain/CorrelationId';

describe('getKeys', () => {
  const correlationId = CorrelationId('test-correlation-id');

  const request = {
    correlationId,
  };

  const mockAppConfig = getMockedAppConfigurationService();

  const ctx = {
    appConfig: mockAppConfig,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return keys successfully when both keys are present', () => {
    mockAppConfig.secretsPrivateKey = 'mock-private-key';
    mockAppConfig.secretsPublicKey = 'mock-public-key';

    const result = getKeys(ctx, request);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({
        privateKey: 'mock-private-key',
        publicKey: 'mock-public-key',
      });
    }
  });

  it('should return error when private key is missing', () => {
    mockAppConfig.secretsPrivateKey = undefined;
    mockAppConfig.secretsPublicKey = 'mock-public-key';

    const result = getKeys(ctx, request);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Missing secrets private key');
      expect(result.error.code).toBe('InternalServer');
      expect(result.error.metadata).toEqual({ correlationId });
    }
  });

  it('should return error when public key is missing', () => {
    mockAppConfig.secretsPrivateKey = 'mock-private-key';
    mockAppConfig.secretsPublicKey = undefined;

    const result = getKeys(ctx, request);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Missing secrets public key');
      expect(result.error.code).toBe('InternalServer');
      expect(result.error.metadata).toEqual({ correlationId });
    }
  });

  it('should return error when both keys are missing', () => {
    mockAppConfig.secretsPrivateKey = undefined;
    mockAppConfig.secretsPublicKey = undefined;

    const result = getKeys(ctx, request);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Missing secrets private key');
      expect(result.error.code).toBe('InternalServer');
      expect(result.error.metadata).toEqual({ correlationId });
    }
  });
});
