import { describe, expect, it } from 'bun:test';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { decodeClaim } from '@backend/services/jwt/actions/decodeClaim';
import { encodeClaim } from '@backend/services/jwt/actions/encodeClaim';

describe('decodeClaim', () => {
  it('should decode a valid JWT token successfully', async () => {
    const logger = getMockedLogger();
    const appConfig = getMockedAppConfigurationService();
    const privateKey = appConfig.jwtPrivateKey!;
    const publicKey = appConfig.jwtPublicKey!;
    const claim = {
      sub: 'user-123',
      aud: ['read:users', 'write:users'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const encodeResult = await encodeClaim({ logger }, { claim, privateKey });
    expect(encodeResult.isOk()).toBe(true);

    if (encodeResult.isOk()) {
      const result = await decodeClaim(
        { logger },
        { token: encodeResult.value, publicKey },
      );

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.sub).toBe('user-123');
        expect(result.value.aud).toEqual(['read:users', 'write:users']);
        expect(result.value.iss).toBe('http://localhost:3000');
        expect(result.value.iat).toBe(claim.iat);
      }
    }
  });

  it('should return error when token is invalid', async () => {
    const logger = getMockedLogger();
    const appConfig = getMockedAppConfigurationService();
    const publicKey = appConfig.jwtPublicKey!;

    const result = await decodeClaim(
      { logger },
      { token: 'invalid.token.here', publicKey },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Failed to verify JWT claim');
      expect(result.error.code).toBe('Unauthorized');
    }
  });
});
