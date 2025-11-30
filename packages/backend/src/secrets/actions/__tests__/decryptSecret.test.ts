import { beforeEach, describe, expect, it, jest, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedEncryptionService } from '@backend/infrastructure/encryption/__mocks__/EncryptionService.mock';
import { decryptSecret } from '@backend/secrets/actions/decryptSecret';
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

  it('should decrypt the secret successfully and remove salt', async () => {
    const saltedValue = `my-secret-value${salt}`;
    mockGetKeys.mockReturnValueOnce(ok(mockKeys));
    mockEncryption.decryptRSA.mockResolvedValueOnce(
      ok(Buffer.from(saltedValue, 'utf8')),
    );

    const result = await decryptSecret(ctx, request, { getKeys: mockGetKeys });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('my-secret-value');
    }
    expect(mockGetKeys).toHaveBeenCalledWith(
      { appConfig: mockAppConfig },
      { correlationId },
    );
    expect(mockEncryption.decryptRSA).toHaveBeenCalledWith({
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
    expect(mockGetKeys).toHaveBeenCalledWith(
      { appConfig: mockAppConfig },
      { correlationId },
    );
    expect(mockEncryption.decryptRSA).not.toHaveBeenCalled();
  });

  it('should return error if decryption fails', async () => {
    mockGetKeys.mockReturnValueOnce(ok(mockKeys));
    mockEncryption.decryptRSA.mockResolvedValueOnce(
      err(
        new ErrorWithMetadata('Decryption failed', 'InternalServer', {
          correlationId,
        }),
      ),
    );

    const result = await decryptSecret(ctx, request, { getKeys: mockGetKeys });

    expect(result.isErr()).toBe(true);
    expect(mockGetKeys).toHaveBeenCalledWith(
      { appConfig: mockAppConfig },
      { correlationId },
    );
    expect(mockEncryption.decryptRSA).toHaveBeenCalledWith({
      correlationId,
      data: expect.any(Buffer),
      privateKey: expect.any(Buffer),
    });
  });
});
