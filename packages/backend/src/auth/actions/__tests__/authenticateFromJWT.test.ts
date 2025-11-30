import { describe, expect, it, mock } from 'bun:test';
import { authenticateFromJWT } from '@backend/auth/actions/authenticateFromJWT';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import { CorrelationId } from '@core/domain/CorrelationId';
import type { Permission } from '@core/domain/permissions/permissions';

import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMockMethods } from '@core/types';
import { err, ok } from 'neverthrow';

describe('authenticateFromJWT', () => {
  const createMockEncryptionService =
    (): ExtractMockMethods<IEncryptionService> => ({
      encryptRSA: mock(),
      decryptRSA: mock(),
      generateSalt: mock(),
      generateKeyPair: mock(),
      encodeJWT: mock(),
      decodeJWT: mock(),
    });

  it('should authenticate user successfully with valid JWT', async () => {
    const logger = getMockedLogger();
    const encryptionService = createMockEncryptionService();
    const encryption = () => encryptionService;
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey ?? 'test-public-key';
    const token = 'valid.jwt.token';
    const correlationId = CorrelationId();

    const mockClaim = {
      sub: 'test-user',
      aud: ['read:users'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
    };

    encryptionService.decodeJWT.mockResolvedValue(ok(mockClaim));

    const result = await authenticateFromJWT(
      { logger, encryption },
      { correlationId, token, publicKey },
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(String(result.value.userId)).toBe('test-user');
      expect(result.value.permissions).toEqual(['read:users']);
    }

    expect(encryptionService.decodeJWT).toHaveBeenCalledWith({
      correlationId,
      token,
      publicKey,
    });
  });

  it('should return error when JWT decode fails', async () => {
    const logger = getMockedLogger();
    const encryptionService = createMockEncryptionService();
    const encryption = () => encryptionService;
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey ?? 'test-public-key';
    const token = 'invalid.jwt.token';

    const decodeError = new ErrorWithMetadata(
      'Failed to verify JWT claim',
      'InternalServer',
    );

    encryptionService.decodeJWT.mockResolvedValue(err(decodeError));

    const result = await authenticateFromJWT(
      { logger, encryption },
      { token, publicKey },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(decodeError);
    }
  });

  it('should return error when validation fails (expired claim)', async () => {
    const logger = getMockedLogger();
    const encryptionService = createMockEncryptionService();
    const encryption = () => encryptionService;
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey ?? 'test-public-key';
    const token = 'valid.jwt.token';

    const mockClaim = {
      sub: 'test-user',
      aud: ['read:users'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) - 3600, // Expired
    };

    encryptionService.decodeJWT.mockResolvedValue(ok(mockClaim));

    const result = await authenticateFromJWT(
      { logger, encryption },
      { token, publicKey },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('JWT claim has expired');
    }
  });

  it('should pass required permissions to validation', async () => {
    const logger = getMockedLogger();
    const encryptionService = createMockEncryptionService();
    const encryption = () => encryptionService;
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey ?? 'test-public-key';
    const token = 'valid.jwt.token';
    const requiredPermissions: Permission[] = ['read:users', 'write:users'];

    const mockClaim = {
      sub: 'test-user',
      aud: ['read:users', 'write:users'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
    };

    encryptionService.decodeJWT.mockResolvedValue(ok(mockClaim));

    const result = await authenticateFromJWT(
      { logger, encryption },
      { token, publicKey, requiredPermissions },
    );

    expect(result.isOk()).toBe(true);
  });

  it('should return error when user ID extraction fails', async () => {
    const logger = getMockedLogger();
    const encryptionService = createMockEncryptionService();
    const encryption = () => encryptionService;
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey ?? 'test-public-key';
    const token = 'valid.jwt.token';

    // Claim with invalid subject type
    const mockClaim = {
      sub: undefined as unknown as string, // Invalid - should be a string
      aud: ['read:users'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
    };

    encryptionService.decodeJWT.mockResolvedValue(ok(mockClaim));

    const result = await authenticateFromJWT(
      { logger, encryption },
      { token, publicKey },
    );

    expect(result.isErr()).toBe(true);
  });

  it('should return error when permissions are missing', async () => {
    const logger = getMockedLogger();
    const encryptionService = createMockEncryptionService();
    const encryption = () => encryptionService;
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey ?? 'test-public-key';
    const token = 'valid.jwt.token';

    // Claim without aud
    const mockClaim = {
      sub: 'test-user',
      aud: undefined as unknown as string[], // Invalid - should be an array
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
    };

    encryptionService.decodeJWT.mockResolvedValue(ok(mockClaim));

    const result = await authenticateFromJWT(
      { logger, encryption },
      { token, publicKey },
    );

    expect(result.isErr()).toBe(true);
  });
});
