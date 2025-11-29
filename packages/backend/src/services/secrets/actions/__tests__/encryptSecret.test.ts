import { beforeEach, describe, expect, it, jest, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedRSAEncryptionService } from '@backend/services/encryption/__mocks__/RSAEncryptionService.mock';
import { encryptSecret } from '@backend/services/secrets/actions/encryptSecret';
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

  const mockAppConfigService = getMockedAppConfigurationService();
  const mockEncryptionService = getMockedRSAEncryptionService();
  const mockGetKeys = mock();

  const ctx = {
    appConfigService: mockAppConfigService,
    encryptionService: mockEncryptionService,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should encrypt the secret successfully', async () => {
    mockGetKeys.mockReturnValueOnce(ok(mockKeys));
    mockEncryptionService.encrypt.mockResolvedValueOnce(
      ok(Buffer.from('encrypted-data')),
    );

    const result = await encryptSecret(ctx, request, { getKeys: mockGetKeys });
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.toString('utf8')).toBe('encrypted-data');
    }
    expect(mockGetKeys).toHaveBeenCalledWith(ctx, { correlationId });
    expect(mockEncryptionService.encrypt).toHaveBeenCalledWith({
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
    expect(mockGetKeys).toHaveBeenCalledWith(ctx, { correlationId });
    expect(mockEncryptionService.encrypt).not.toHaveBeenCalled();
  });

  it('should return error if encryption fails', async () => {
    mockGetKeys.mockReturnValueOnce(ok(mockKeys));
    mockEncryptionService.encrypt.mockResolvedValueOnce(
      err(
        new ErrorWithMetadata('Encryption failed', 'InternalServer', {
          correlationId,
        }),
      ),
    );
    const result = await encryptSecret(ctx, request, { getKeys: mockGetKeys });
    expect(result.isErr()).toBe(true);
    expect(mockGetKeys).toHaveBeenCalledWith(ctx, { correlationId });
    expect(mockEncryptionService.encrypt).toHaveBeenCalledWith({
      correlationId,
      data: expect.any(Buffer),
      publicKey: expect.any(Buffer),
    });
  });
});
