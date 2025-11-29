import { describe, expect, it } from 'bun:test';
import { extractUserId } from '@backend/services/jwt/actions/extractUserId';
import { UserId } from '@core/domain/user/user';

describe('extractUserId', () => {
  it('should extract user ID from claim successfully', () => {
    const userId = UserId('user-123');
    const claim = {
      sub: userId,
      aud: ['read'],
      iss: 'http://localhost:3000',
      iat: Math.floor(Date.now() / 1000),
    };

    const result = extractUserId(claim);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(userId);
    }
  });
});
