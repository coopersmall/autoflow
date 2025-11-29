import { describe, expect, it } from 'bun:test';
import { extractPermissions } from '@backend/services/jwt/actions/extractPermissions';
import { UserId } from '@core/domain/user/user';

describe('extractPermissions', () => {
  it('should extract permissions from claim successfully', () => {
    const claim = {
      sub: UserId('user-123'),
      aud: ['read:users', 'write:users'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
    };

    const result = extractPermissions(claim);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(['read:users', 'write:users']);
    }
  });

  it('should filter out invalid permissions', () => {
    const claim = {
      sub: UserId('user-123'),
      aud: ['read:users', 'invalid-permission', 'write:users'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
    };

    const result = extractPermissions(claim);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(['read:users', 'write:users']);
    }
  });
});
