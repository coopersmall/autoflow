import { describe, expect, it } from 'bun:test';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { validateClaim } from '@backend/services/jwt/actions/validateClaim';

describe('validateClaim', () => {
  it('should validate a valid JWT claim successfully', () => {
    const logger = getMockedLogger();
    const claim = {
      sub: 'user-123',
      aud: ['read'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const result = validateClaim({ logger }, { claim });

    expect(result.isOk()).toBe(true);
  });

  it('should return error when claim subject is missing', () => {
    const logger = getMockedLogger();
    const claim = {
      sub: '',
      aud: ['read'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
    };

    const result = validateClaim({ logger }, { claim });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('JWT claim missing or invalid subject');
      expect(result.error.code).toBe('Unauthorized');
    }
  });

  it('should return error when claim is expired', () => {
    const logger = getMockedLogger();
    const claim = {
      sub: 'user-123',
      aud: ['read'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000) - 7200,
      exp: Math.floor(Date.now() / 1000) - 3600,
    };

    const result = validateClaim({ logger }, { claim });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('JWT claim has expired');
      expect(result.error.code).toBe('Unauthorized');
    }
  });

  it('should return error when required permission is missing', () => {
    const logger = getMockedLogger();
    const claim = {
      sub: 'user-123',
      aud: ['read'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const result = validateClaim(
      { logger },
      { claim, requiredPermissions: ['write:users'] },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe(
        'JWT claim missing required permissions',
      );
      expect(result.error.code).toBe('Forbidden');
    }
  });

  it('should validate successfully when required permissions are present', () => {
    const logger = getMockedLogger();
    const claim = {
      sub: 'user-123',
      aud: ['read:users', 'write:users'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const result = validateClaim(
      { logger },
      { claim, requiredPermissions: ['read:users'] },
    );

    expect(result.isOk()).toBe(true);
  });
});
