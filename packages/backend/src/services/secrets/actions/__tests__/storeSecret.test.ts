import { beforeEach, describe, expect, it, jest, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedRSAEncryptionService } from '@backend/services/encryption/__mocks__/RSAEncryptionService.mock';
import { getMockedSecretService } from '@backend/services/secrets/__mocks__/SecretService.mock';
import { storeSecret } from '@backend/services/secrets/actions/storeSecret';
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

  const mockAppConfigService = getMockedAppConfigurationService();
  const mockEncryptionService = getMockedRSAEncryptionService();
  const mockSecretService = getMockedSecretService();
  const mockEncryptSecret = mock();

  const ctx = {
    appConfigService: mockAppConfigService,
    encryptionService: mockEncryptionService,
    secretService: mockSecretService,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEncryptionService.generateSalt.mockReturnValue(salt);
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
    mockSecretService.create.mockResolvedValueOnce(ok(expectedSecret));

    const result = await storeSecret(ctx, request, {
      encryptSecret: mockEncryptSecret,
    });

    expect(result.isOk()).toBe(true);
    expect(mockEncryptionService.generateSalt).toHaveBeenCalled();
    expect(mockEncryptSecret).toHaveBeenCalledWith(ctx, {
      correlationId,
      value,
      salt,
    });
    expect(mockSecretService.create).toHaveBeenCalledWith(userId, {
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
    expect(mockEncryptionService.generateSalt).toHaveBeenCalled();
    expect(mockEncryptSecret).toHaveBeenCalledWith(ctx, {
      correlationId,
      value,
      salt,
    });
    expect(mockSecretService.create).not.toHaveBeenCalled();
  });

  it('should return error if secret creation fails', async () => {
    const encryptedData = Buffer.from('encrypted-data');
    mockEncryptSecret.mockResolvedValueOnce(ok(encryptedData));
    mockSecretService.create.mockResolvedValueOnce(
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
    expect(mockEncryptionService.generateSalt).toHaveBeenCalled();
    expect(mockEncryptSecret).toHaveBeenCalledWith(ctx, {
      correlationId,
      value,
      salt,
    });
    expect(mockSecretService.create).toHaveBeenCalledWith(userId, {
      ...data,
      salt,
      encryptedValue: encryptedData.toString('base64'),
    });
  });
});
