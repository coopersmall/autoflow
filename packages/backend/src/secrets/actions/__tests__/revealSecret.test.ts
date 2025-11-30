import { beforeEach, describe, expect, it, jest, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedEncryptionService } from '@backend/infrastructure/encryption/__mocks__/EncryptionService.mock';
import { getMockedSecretsService } from '@backend/secrets/__mocks__/SecretsService.mock';
import { revealSecret } from '@backend/secrets/actions/revealSecret';
import { CorrelationId } from '@core/domain/CorrelationId';
import { SecretId, type StoredSecret } from '@core/domain/secrets/Secret';
import { UserId } from '@core/domain/user/user';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok } from 'neverthrow';

describe('revealSecret', () => {
  const correlationId = CorrelationId('test-correlation-id');
  const userId = UserId('test-user-id');
  const secretId = SecretId('test-secret-id');
  const secretValue = 'my-secret-value';

  const request = {
    correlationId,
    userId,
    id: secretId,
  };

  const storedSecret: StoredSecret = {
    id: secretId,
    name: 'Test Secret',
    type: 'stored',
    schemaVersion: 1,
    salt: 'test-salt',
    encryptedValue: 'encrypted-value',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
  };

  const mockAppConfig = getMockedAppConfigurationService();
  const mockEncryption = getMockedEncryptionService();
  const mockSecrets = getMockedSecretsService();
  const mockDecryptSecret = mock();

  const ctx = {
    appConfig: mockAppConfig,
    encryption: mockEncryption,
    secrets: mockSecrets,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reveal the secret successfully', async () => {
    mockSecrets.get.mockResolvedValueOnce(ok(storedSecret));
    mockDecryptSecret.mockResolvedValueOnce(ok(secretValue));

    const result = await revealSecret(ctx, request, {
      decryptSecret: mockDecryptSecret,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.value).toBe(secretValue);
      expect(result.value.id).toBe(secretId);
      expect(result.value.name).toBe('Test Secret');
    }
    expect(mockSecrets.get).toHaveBeenCalledWith(secretId, userId);
    expect(mockDecryptSecret).toHaveBeenCalledWith(
      { appConfig: mockAppConfig, encryption: mockEncryption },
      {
        correlationId,
        encryptedValue: storedSecret.encryptedValue,
        salt: storedSecret.salt,
      },
    );
  });

  it('should return error if secret not found', async () => {
    mockSecrets.get.mockResolvedValueOnce(
      err(
        new ErrorWithMetadata('Secret not found', 'NotFound', {
          correlationId,
        }),
      ),
    );

    const result = await revealSecret(ctx, request, {
      decryptSecret: mockDecryptSecret,
    });

    expect(result.isErr()).toBe(true);
    expect(mockSecrets.get).toHaveBeenCalledWith(secretId, userId);
    expect(mockDecryptSecret).not.toHaveBeenCalled();
  });

  it('should return error if decryption fails', async () => {
    mockSecrets.get.mockResolvedValueOnce(ok(storedSecret));
    mockDecryptSecret.mockResolvedValueOnce(
      err(
        new ErrorWithMetadata('Decryption failed', 'InternalServer', {
          correlationId,
        }),
      ),
    );

    const result = await revealSecret(ctx, request, {
      decryptSecret: mockDecryptSecret,
    });

    expect(result.isErr()).toBe(true);
    expect(mockSecrets.get).toHaveBeenCalledWith(secretId, userId);
    expect(mockDecryptSecret).toHaveBeenCalledWith(
      { appConfig: mockAppConfig, encryption: mockEncryption },
      {
        correlationId,
        encryptedValue: storedSecret.encryptedValue,
        salt: storedSecret.salt,
      },
    );
  });
});
