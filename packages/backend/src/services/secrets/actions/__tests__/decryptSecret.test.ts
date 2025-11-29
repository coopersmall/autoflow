import { beforeEach, describe, expect, it, jest, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedRSAEncryptionService } from '@backend/services/encryption/__mocks__/RSAEncryptionService.mock';
import { decryptSecret } from '@backend/services/secrets/actions/decryptSecret';
import { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok } from 'neverthrow';

describe('decryptSecret', () => {
  const correlationId = CorrelationId('test-correlation-id');
  const encryptedValue = 'base64-encrypted-value';
  const salt = 'random-salt';

  const request = {
    correlationId,
    encryptedValue,
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

  it('should decrypt the secret successfully and remove salt', async () => {
    const saltedValue = `my-secret-value${salt}`;
    mockGetKeys.mockReturnValueOnce(ok(mockKeys));
    mockEncryptionService.decrypt.mockResolvedValueOnce(
      ok(Buffer.from(saltedValue, 'utf8')),
    );

    const result = await decryptSecret(ctx, request, { getKeys: mockGetKeys });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('my-secret-value');
    }
    expect(mockGetKeys).toHaveBeenCalledWith(ctx, { correlationId });
    expect(mockEncryptionService.decrypt).toHaveBeenCalledWith({
      correlationId,
      data: expect.any(Buffer),
      privateKey: expect.any(Buffer),
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

    const result = await decryptSecret(ctx, request, { getKeys: mockGetKeys });

    expect(result.isErr()).toBe(true);
    expect(mockGetKeys).toHaveBeenCalledWith(ctx, { correlationId });
    expect(mockEncryptionService.decrypt).not.toHaveBeenCalled();
  });

  it('should return error if decryption fails', async () => {
    mockGetKeys.mockReturnValueOnce(ok(mockKeys));
    mockEncryptionService.decrypt.mockResolvedValueOnce(
      err(
        new ErrorWithMetadata('Decryption failed', 'InternalServer', {
          correlationId,
        }),
      ),
    );

    const result = await decryptSecret(ctx, request, { getKeys: mockGetKeys });

    expect(result.isErr()).toBe(true);
    expect(mockGetKeys).toHaveBeenCalledWith(ctx, { correlationId });
    expect(mockEncryptionService.decrypt).toHaveBeenCalledWith({
      correlationId,
      data: expect.any(Buffer),
      privateKey: expect.any(Buffer),
    });
  });
});
