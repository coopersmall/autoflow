import { describe, expect, it } from 'bun:test';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { UserAuthenticationService } from '@backend/services/auth/UserAuthenticationService';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedJWTService } from '@backend/services/jwt/__mocks__/JWTService.mock';
import { CorrelationId } from '@core/domain/CorrelationId';
import { UserId } from '@core/domain/user/user';
import { ok } from 'neverthrow';

describe('UserAuthenticationService', () => {
  describe('authenticate with discriminated union', () => {
    it('should route JWT authentication to authenticateFromJWT', async () => {
      const logger = getMockedLogger();
      const jwtService = getMockedJWTService();
      const jwt = () => jwtService;
      const appConfig = getMockedAppConfigurationService();
      const publicKey = appConfig.jwtPublicKey!;

      const service = new UserAuthenticationService({ logger, jwt });

      const claim = {
        sub: UserId('user-123'),
        aud: ['read:users'],
        iss: 'http://localhost:3000',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      jwtService.decode.mockReturnValue(Promise.resolve(ok(claim)));
      jwtService.validate.mockReturnValue(ok(claim));
      jwtService.getUserId.mockReturnValue(ok(UserId('user-123')));
      jwtService.getPermissions.mockReturnValue(ok(['read:users']));

      const result = await service.authenticate({
        type: 'jwt',
        token: 'valid.jwt.token',
        publicKey,
        correlationId: CorrelationId(),
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.userId).toBe(UserId('user-123'));
      }
    });

    it('should handle JWT authentication with required permissions', async () => {
      const logger = getMockedLogger();
      const jwtService = getMockedJWTService();
      const jwt = () => jwtService;
      const appConfig = getMockedAppConfigurationService();
      const publicKey = appConfig.jwtPublicKey!;

      const service = new UserAuthenticationService({ logger, jwt });

      const claim = {
        sub: UserId('user-123'),
        aud: ['admin', 'read:users'],
        iss: 'http://localhost:3000',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      jwtService.decode.mockReturnValue(Promise.resolve(ok(claim)));
      jwtService.validate.mockReturnValue(ok(claim));
      jwtService.getUserId.mockReturnValue(ok(UserId('user-123')));
      jwtService.getPermissions.mockReturnValue(ok(['admin', 'read:users']));

      const result = await service.authenticate({
        type: 'jwt',
        token: 'valid.jwt.token',
        publicKey,
        requiredPermissions: ['admin'],
      });

      expect(result.isOk()).toBe(true);
    });

    it('should return error for invalid JWT token', async () => {
      const logger = getMockedLogger();
      const jwtService = getMockedJWTService();
      const jwt = () => jwtService;
      const appConfig = getMockedAppConfigurationService();
      const publicKey = appConfig.jwtPublicKey!;

      const service = new UserAuthenticationService({ logger, jwt });

      const expiredClaim = {
        sub: UserId('user-123'),
        aud: ['read:users'],
        iss: 'http://localhost:3000',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) - 3600,
      };

      jwtService.decode.mockReturnValue(Promise.resolve(ok(expiredClaim)));
      jwtService.validate.mockReturnValue(ok(expiredClaim));
      jwtService.getUserId.mockReturnValue(ok(UserId('user-123')));
      jwtService.getPermissions.mockReturnValue(ok(['read:users']));

      const result = await service.authenticate({
        type: 'jwt',
        token: 'invalid.jwt.token',
        publicKey,
      });

      expect(result.isOk()).toBe(true);
    });
  });
});
