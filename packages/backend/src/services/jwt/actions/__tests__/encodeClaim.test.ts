import { describe, expect, it } from 'bun:test';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { encodeClaim } from '@backend/services/jwt/actions/encodeClaim';

describe('encodeClaim', () => {
  it('should encode a JWT claim successfully', async () => {
    const logger = getMockedLogger();
    const appConfig = getMockedAppConfigurationService();
    const privateKey = appConfig.jwtPrivateKey!;
    const claim = {
      sub: 'user-123',
      aud: ['read'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const result = await encodeClaim({ logger }, { claim, privateKey });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(typeof result.value).toBe('string');
      expect(result.value.split('.').length).toBe(3);
    }
  });

  it('should return error when encoding fails with invalid key', async () => {
    const logger = getMockedLogger();
    const privateKey = 'invalid-key';
    const claim = {
      sub: 'user-123',
      aud: ['read'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const result = await encodeClaim({ logger }, { claim, privateKey });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Failed to import private key');
      expect(result.error.code).toBe('InternalServer');
    }
  });
});
