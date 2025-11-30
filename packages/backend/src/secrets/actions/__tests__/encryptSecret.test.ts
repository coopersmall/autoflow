import { beforeEach, describe, expect, it, jest, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedEncryptionService } from '@backend/infrastructure/encryption/__mocks__/EncryptionService.mock';
import { encryptSecret } from '@backend/secrets/actions/encryptSecret';
import { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok } from 'neverthrow';

describe('encryptSecret', () => {
  const correlationId = CorrelationId('test-correlation-id');
  const value = 'my-secret-value';
  const salt = 'random-salt';

  const request = {
    correlationId,
    value,
    salt,
  };

  const mockKeys = {
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
  };

  const mockAppConfig = getMockedAppConfigurationService();
  const mockEncryption = getMockedEncryptionService();
  const mockGetKeys = mock();

  const ctx = {
    appConfig: mockAppConfig,
    encryption: mockEncryption,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should encrypt the secret successfully', async () => {
    mockGetKeys.mockReturnValueOnce(ok(mockKeys));
    mockEncryption.encryptRSA.mockResolvedValueOnce(
      ok(Buffer.from('encrypted-data')),
    );

    const result = await encryptSecret(ctx, request, { getKeys: mockGetKeys });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.toString('utf8')).toBe('encrypted-data');
    }
    expect(mockGetKeys).toHaveBeenCalledWith(
      { appConfig: mockAppConfig },
      { correlationId },
    );
    expect(mockEncryption.encryptRSA).toHaveBeenCalledWith({
      correlationId,
      data: expect.any(Buffer),
      publicKey: expect.any(Buffer),
    });
  });

  it('should return error if getKeys fails', async () => {
    mockGetKeys.mockReturnValueOnce(
      err(
        new ErrorWithMetadata('Key retrieval failed', 'NotFound', {
          correlationId,
        }),
      ),
    );
    const result = await encryptSecret(ctx, request, { getKeys: mockGetKeys });
    expect(result.isErr()).toBe(true);
    expect(mockGetKeys).toHaveBeenCalledWith(
      { appConfig: mockAppConfig },
      { correlationId },
    );
    expect(mockEncryption.encryptRSA).not.toHaveBeenCalled();
  });

  it('should return error if encryption fails', async () => {
    mockGetKeys.mockReturnValueOnce(ok(mockKeys));
    mockEncryption.encryptRSA.mockResolvedValueOnce(
      err(
        new ErrorWithMetadata('Encryption failed', 'InternalServer', {
          correlationId,
        }),
      ),
    );
    const result = await encryptSecret(ctx, request, { getKeys: mockGetKeys });
    expect(result.isErr()).toBe(true);
    expect(mockGetKeys).toHaveBeenCalledWith(
      { appConfig: mockAppConfig },
      { correlationId },
    );
    expect(mockEncryption.encryptRSA).toHaveBeenCalledWith({
      correlationId,
      data: expect.any(Buffer),
      publicKey: expect.any(Buffer),
    });
  });
});
