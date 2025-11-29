import { describe, expect, it, mock } from 'bun:test';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { authenticateFromJWT } from '@backend/services/auth/actions/authenticateFromJWT';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import type { IJWTService } from '@backend/services/jwt/JWTService';
import { CorrelationId } from '@core/domain/CorrelationId';
import type { Permission } from '@core/domain/permissions/permissions';
import { UserId } from '@core/domain/user/user';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMockMethods } from '@core/types';
import { err, ok } from 'neverthrow';

describe('authenticateFromJWT', () => {
  const createMockJWTService = (): ExtractMockMethods<IJWTService> => ({
    create: mock(),
    encode: mock(),
    decode: mock(),
    validate: mock(),
    generateKeys: mock(),
    getUserId: mock(),
    getPermissions: mock(),
    createAndEncode: mock(),
    decodeAndValidate: mock(),
  });

  it('should authenticate user successfully with valid JWT', async () => {
    const logger = getMockedLogger();
    const jwtService = createMockJWTService();
    const jwt = () => jwtService;
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey!;
    const token = 'valid.jwt.token';
    const correlationId = CorrelationId();

    const mockClaim = {
      sub: 'test-user',
      aud: ['read:users'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
    };

    jwtService.decode.mockResolvedValue(ok(mockClaim));
    jwtService.validate.mockReturnValue(ok(mockClaim));
    jwtService.getUserId.mockReturnValue(ok(UserId('test-user')));
    jwtService.getPermissions.mockReturnValue(ok(['read:users']));

    const result = await authenticateFromJWT(
      { logger, jwt },
      { correlationId, token, publicKey },
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(String(result.value.userId)).toBe('test-user');
      expect(result.value.permissions).toEqual(['read:users']);
    }

    expect(jwtService.decode).toHaveBeenCalledWith({
      correlationId,
      token,
      publicKey,
    });
  });

  it('should return error when JWT decode fails', async () => {
    const logger = getMockedLogger();
    const jwtService = createMockJWTService();
    const jwt = () => jwtService;
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey!;
    const token = 'invalid.jwt.token';

    const decodeError = new ErrorWithMetadata(
      'Failed to verify JWT claim',
      'InternalServer',
    );

    jwtService.decode.mockResolvedValue(err(decodeError));

    const result = await authenticateFromJWT(
      { logger, jwt },
      { token, publicKey },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(decodeError);
    }
  });

  it('should return error when validation fails', async () => {
    const logger = getMockedLogger();
    const jwtService = createMockJWTService();
    const jwt = () => jwtService;
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey!;
    const token = 'valid.jwt.token';

    const mockClaim = {
      sub: 'test-user',
      aud: ['read:users'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) - 3600,
    };

    const validationError = new ErrorWithMetadata(
      'JWT claim is expired',
      'Unauthorized',
    );

    jwtService.decode.mockResolvedValue(ok(mockClaim));
    jwtService.validate.mockReturnValue(err(validationError));

    const result = await authenticateFromJWT(
      { logger, jwt },
      { token, publicKey },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(validationError);
    }
  });

  it('should pass required permissions to JWT service', async () => {
    const logger = getMockedLogger();
    const jwtService = createMockJWTService();
    const jwt = () => jwtService;
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey!;
    const token = 'valid.jwt.token';
    const requiredPermissions: Permission[] = ['read:users', 'write:users'];

    const mockClaim = {
      sub: 'test-user',
      aud: ['read:users', 'write:users'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
    };

    jwtService.decode.mockResolvedValue(ok(mockClaim));
    jwtService.validate.mockReturnValue(ok(mockClaim));
    jwtService.getUserId.mockReturnValue(ok(UserId('test-user')));
    jwtService.getPermissions.mockReturnValue(
      ok(['read:users', 'write:users']),
    );

    const result = await authenticateFromJWT(
      { logger, jwt },
      { token, publicKey, requiredPermissions },
    );

    expect(result.isOk()).toBe(true);
    expect(jwtService.validate).toHaveBeenCalledWith({
      correlationId: undefined,
      claim: mockClaim,
      requiredPermissions,
    });
  });

  it('should return error when getUserId fails', async () => {
    const logger = getMockedLogger();
    const jwtService = createMockJWTService();
    const jwt = () => jwtService;
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey!;
    const token = 'valid.jwt.token';

    const mockClaim = {
      sub: 'invalid',
      aud: ['read:users'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
    };

    const userIdError = new ErrorWithMetadata(
      'Invalid user ID in claim',
      'InternalServer',
    );

    jwtService.decode.mockResolvedValue(ok(mockClaim));
    jwtService.validate.mockReturnValue(ok(mockClaim));
    jwtService.getUserId.mockReturnValue(err(userIdError));

    const result = await authenticateFromJWT(
      { logger, jwt },
      { token, publicKey },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(userIdError);
    }
  });

  it('should return error when getPermissions fails', async () => {
    const logger = getMockedLogger();
    const jwtService = createMockJWTService();
    const jwt = () => jwtService;
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey!;
    const token = 'valid.jwt.token';

    const mockClaim = {
      sub: 'test-user',
      aud: ['invalid-permission'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
    };

    const permissionsError = new ErrorWithMetadata(
      'Invalid permissions in claim',
      'InternalServer',
    );

    jwtService.decode.mockResolvedValue(ok(mockClaim));
    jwtService.validate.mockReturnValue(ok(mockClaim));
    jwtService.getUserId.mockReturnValue(ok(UserId('test-user')));
    jwtService.getPermissions.mockReturnValue(err(permissionsError));

    const result = await authenticateFromJWT(
      { logger, jwt },
      { token, publicKey },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(permissionsError);
    }
  });
});
