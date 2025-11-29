import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { createClaim } from '@backend/services/jwt/actions/createClaim';
import { CorrelationId } from '@core/domain/CorrelationId';
import type { Permission } from '@core/domain/permissions/permissions';
import { UserId } from '@core/domain/user/user';

describe('createClaim', () => {
  const correlationId = CorrelationId('test-correlation-id');
  const userId = UserId('user-123');
  const permissions: Permission[] = ['read:users', 'write:users'];

  const mockLogger = getMockedLogger();
  const mockAppConfig = getMockedAppConfigurationService();

  const ctx = {
    logger: mockLogger,
    appConfig: () => mockAppConfig,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create JWT claim with userId and permissions', () => {
    mockAppConfig.isLocal.mockReturnValueOnce(false);
    mockAppConfig.site = 'https://example.com';

    const request = {
      correlationId,
      userId,
      permissions: [...permissions],
    };

    const result = createClaim(ctx, request);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const claim = result.value;
      expect(claim.sub).toBe(userId);
      expect(claim.aud).toEqual(permissions);
      expect(claim.iss).toBe('https://example.com');
      expect(claim.iat).toBeGreaterThan(0);
      expect(claim.exp).toBeGreaterThan(claim.iat);
    }
  });

  it('should create claim with all permissions in local environment', () => {
    mockAppConfig.isLocal.mockReturnValueOnce(true);
    mockAppConfig.site = 'http://localhost:3000';

    const request = {
      correlationId,
      userId,
      permissions: [...permissions],
    };

    const result = createClaim(ctx, request);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const claim = result.value;
      expect(claim.aud).toContain('admin');
      expect(claim.aud).toContain('read:users');
      expect(claim.aud).toContain('write:users');
    }
  });

  it('should create claim without expiration in local environment', () => {
    mockAppConfig.isLocal.mockReturnValueOnce(true);
    mockAppConfig.site = 'http://localhost:3000';

    const request = {
      correlationId,
      userId,
      permissions: [...permissions],
    };

    const result = createClaim(ctx, request);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const claim = result.value;
      expect(claim.exp).toBeUndefined();
    }
  });

  it('should create claim with custom expiration time in non-local environment', () => {
    const customExpiration = 3600;
    mockAppConfig.isLocal.mockReturnValueOnce(false);
    mockAppConfig.site = 'https://example.com';

    const request = {
      correlationId,
      userId,
      permissions: [...permissions],
      expirationTime: customExpiration,
    };

    const beforeTime = Math.floor(Date.now() / 1000);
    const result = createClaim(ctx, request);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const claim = result.value;
      expect(claim.exp).toBeDefined();
      expect(claim.exp).toBeGreaterThanOrEqual(beforeTime + customExpiration);
    }
  });

  it('should include expiration in production environment', () => {
    mockAppConfig.isLocal.mockReturnValueOnce(false);
    mockAppConfig.site = 'https://prod.example.com';

    const request = {
      correlationId,
      userId,
      permissions: [...permissions],
    };

    const result = createClaim(ctx, request);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.exp).toBeDefined();
    }
  });

  it('should log debug message with claim details', () => {
    mockAppConfig.isLocal.mockReturnValueOnce(false);
    mockAppConfig.site = 'https://example.com';

    const request = {
      correlationId,
      userId,
      permissions: [...permissions],
    };

    const result = createClaim(ctx, request);

    expect(result.isOk()).toBe(true);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Created JWT claim',
      expect.objectContaining({
        correlationId,
        userId,
        permissions: [...permissions],
        expiresAt: expect.any(Number),
      }),
    );
  });

  it('should include issued at timestamp', () => {
    mockAppConfig.isLocal.mockReturnValueOnce(false);
    mockAppConfig.site = 'https://example.com';

    const request = {
      correlationId,
      userId,
      permissions: [...permissions],
    };

    const beforeTime = Math.floor(Date.now() / 1000);
    const result = createClaim(ctx, request);
    const afterTime = Math.floor(Date.now() / 1000);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const claim = result.value;
      expect(claim.iat).toBeGreaterThanOrEqual(beforeTime);
      expect(claim.iat).toBeLessThanOrEqual(afterTime);
    }
  });

  it('should use site from appConfig as issuer', () => {
    const customSite = 'https://custom.example.com';
    mockAppConfig.isLocal.mockReturnValueOnce(false);
    mockAppConfig.site = customSite;

    const request = {
      correlationId,
      userId,
      permissions: [...permissions],
    };

    const result = createClaim(ctx, request);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.iss).toBe(customSite);
    }
  });
});
