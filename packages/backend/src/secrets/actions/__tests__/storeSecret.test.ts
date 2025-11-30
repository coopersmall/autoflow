import { beforeEach, describe, expect, it, jest, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedEncryptionService } from '@backend/infrastructure/encryption/__mocks__/EncryptionService.mock';
import { getMockedSecretsService } from '@backend/secrets/__mocks__/SecretsService.mock';
import { storeSecret } from '@backend/secrets/actions/storeSecret';
import { CorrelationId } from '@core/domain/CorrelationId';
import { SecretId, type StoredSecret } from '@core/domain/secrets/Secret';
import { UserId } from '@core/domain/user/user';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok } from 'neverthrow';

describe('storeSecret', () => {
  const correlationId = CorrelationId('test-correlation-id');
  const userId = UserId('test-user-id');
  const value = 'my-secret-value';
  const salt = 'generated-salt';

  const data = {
    name: 'Test Secret',
    type: 'stored' as const,
    schemaVersion: 1 as const,
    metadata: {
      createdBy: userId,
    },
  };

  const request = {
    correlationId,
    userId,
    value,
    data,
  };

  const mockAppConfig = getMockedAppConfigurationService();
  const mockEncryption = getMockedEncryptionService();
  const mockSecrets = getMockedSecretsService();
  const mockEncryptSecret = mock();

  const ctx = {
    appConfig: mockAppConfig,
    encryption: mockEncryption,
    secrets: mockSecrets,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEncryption.generateSalt.mockReturnValue(salt);
  });

  it('should store the secret successfully', async () => {
    const encryptedData = Buffer.from('encrypted-data');
    const expectedSecret: StoredSecret = {
      ...data,
      id: SecretId('generated-secret-id'),
      createdAt: new Date(),
      updatedAt: new Date(),
      salt,
      encryptedValue: encryptedData.toString('base64'),
    };

    mockEncryptSecret.mockResolvedValueOnce(ok(encryptedData));
    mockSecrets.create.mockResolvedValueOnce(ok(expectedSecret));

    const result = await storeSecret(ctx, request, {
      encryptSecret: mockEncryptSecret,
    });

    expect(result.isOk()).toBe(true);
    expect(mockEncryption.generateSalt).toHaveBeenCalled();
    expect(mockEncryptSecret).toHaveBeenCalledWith(
      { appConfig: mockAppConfig, encryption: mockEncryption },
      {
        correlationId,
        value,
        salt,
      },
    );
    expect(mockSecrets.create).toHaveBeenCalledWith(userId, {
      ...data,
      salt,
      encryptedValue: encryptedData.toString('base64'),
    });
  });

  it('should return error if encryption fails', async () => {
    mockEncryptSecret.mockResolvedValueOnce(
      err(
        new ErrorWithMetadata('Encryption failed', 'InternalServer', {
          correlationId,
        }),
      ),
    );

    const result = await storeSecret(ctx, request, {
      encryptSecret: mockEncryptSecret,
    });

    expect(result.isErr()).toBe(true);
    expect(mockEncryption.generateSalt).toHaveBeenCalled();
    expect(mockEncryptSecret).toHaveBeenCalledWith(
      { appConfig: mockAppConfig, encryption: mockEncryption },
      {
        correlationId,
        value,
        salt,
      },
    );
    expect(mockSecrets.create).not.toHaveBeenCalled();
  });

  it('should return error if secret creation fails', async () => {
    const encryptedData = Buffer.from('encrypted-data');
    mockEncryptSecret.mockResolvedValueOnce(ok(encryptedData));
    mockSecrets.create.mockResolvedValueOnce(
      err(
        new ErrorWithMetadata('Secret creation failed', 'InternalServer', {
          correlationId,
        }),
      ),
    );

    const result = await storeSecret(ctx, request, {
      encryptSecret: mockEncryptSecret,
    });

    expect(result.isErr()).toBe(true);
    expect(mockEncryption.generateSalt).toHaveBeenCalled();
    expect(mockEncryptSecret).toHaveBeenCalledWith(
      { appConfig: mockAppConfig, encryption: mockEncryption },
      {
        correlationId,
        value,
        salt,
      },
    );
    expect(mockSecrets.create).toHaveBeenCalledWith(userId, {
      ...data,
      salt,
      encryptedValue: encryptedData.toString('base64'),
    });
  });
});
