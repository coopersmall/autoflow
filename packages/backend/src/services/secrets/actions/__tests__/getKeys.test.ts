import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { getKeys } from '@backend/services/secrets/actions/getKeys';
import { CorrelationId } from '@core/domain/CorrelationId';

describe('getKeys', () => {
  const correlationId = CorrelationId('test-correlation-id');

  const request = {
    correlationId,
  };

  const mockAppConfigService = getMockedAppConfigurationService();

  const ctx = {
    appConfigService: mockAppConfigService,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return keys successfully when both keys are present', () => {
    mockAppConfigService.secretsPrivateKey = 'mock-private-key';
    mockAppConfigService.secretsPublicKey = 'mock-public-key';

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
    mockAppConfigService.secretsPrivateKey = undefined;
    mockAppConfigService.secretsPublicKey = 'mock-public-key';

    const result = getKeys(ctx, request);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Missing secrets private key');
      expect(result.error.code).toBe('InternalServer');
      expect(result.error.metadata).toEqual({ correlationId });
    }
  });

  it('should return error when public key is missing', () => {
    mockAppConfigService.secretsPrivateKey = 'mock-private-key';
    mockAppConfigService.secretsPublicKey = undefined;

    const result = getKeys(ctx, request);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Missing secrets public key');
      expect(result.error.code).toBe('InternalServer');
      expect(result.error.metadata).toEqual({ correlationId });
    }
  });

  it('should return error when both keys are missing', () => {
    mockAppConfigService.secretsPrivateKey = undefined;
    mockAppConfigService.secretsPublicKey = undefined;

    const result = getKeys(ctx, request);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Missing secrets private key');
      expect(result.error.code).toBe('InternalServer');
      expect(result.error.metadata).toEqual({ correlationId });
    }
  });
});
