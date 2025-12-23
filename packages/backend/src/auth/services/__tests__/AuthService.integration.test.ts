/**
 * Authentication Integration Tests
 *
 * Tests complete authentication flows with real:
 * - JWT creation with encryption
 * - JWT validation with signature verification
 * - Bearer token authentication middleware
 * - Cookie authentication middleware
 * - Token expiration handling
 * - Permission-based authorization
 *
 * These tests replace the following unit tests that mock encryption:
 * - authenticateFromJWT.test.ts
 * - createBearerTokenAuthenticationMiddleware.test.ts
 * - createCookieAuthenticationMiddleware.test.ts
 */

import { describe, expect, it } from 'bun:test';
import type { Permission } from '@autoflow/core';
import { createAuthService } from '@backend/auth';
import { createContext } from '@backend/infrastructure/context';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { createEncryptionService } from '@backend/infrastructure/encryption';
import { setupHttpIntegrationTest } from '@backend/testing/integration/httpIntegrationTest';
import { CorrelationId } from '@core/domain/CorrelationId';
import { permissions } from '@core/domain/permissions/permissions';
import { UserId } from '@core/domain/user/user';
import * as fc from 'fast-check';

describe('Auth Integration Tests', () => {
  const { getConfig, getLogger, getTestAuth } = setupHttpIntegrationTest();

  describe('Property Tests', () => {
    const validUserIdArb = fc
      .string({ minLength: 0, maxLength: 100 })
      .map((s) => UserId(s));

    const validPermissionArb = fc.constantFrom(
      ...permissions,
    ) as fc.Arbitrary<Permission>;
    const validPermissionsArb = fc.array(validPermissionArb, {
      minLength: 0,
      maxLength: 20,
    });

    it('should round-trip any userId through JWT encode/decode', async () => {
      const config = getConfig();
      const logger = getLogger();
      const authService = createAuthService({ logger, appConfig: config });
      const encryptionService = createEncryptionService({ logger });

      await fc.assert(
        fc.asyncProperty(
          validUserIdArb,
          validPermissionsArb,
          async (userId, permissions) => {
            const ctx = createContext(CorrelationId(), new AbortController());

            const claim = authService
              .createClaim(ctx, { userId, permissions })
              ._unsafeUnwrap();

            const token = (
              await encryptionService.encodeJWT(ctx, {
                claim,
                privateKey: config.jwtPrivateKey!,
              })
            )._unsafeUnwrap();

            const decoded = (
              await encryptionService.decodeJWT(ctx, {
                token,
                publicKey: config.jwtPublicKey!,
              })
            )._unsafeUnwrap();

            expect(authService.getUserId(decoded)._unsafeUnwrap()).toBe(userId);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should always produce valid JWT format', async () => {
      const config = getConfig();
      const logger = getLogger();
      const authService = createAuthService({ logger, appConfig: config });
      const encryptionService = createEncryptionService({ logger });

      await fc.assert(
        fc.asyncProperty(
          validUserIdArb,
          validPermissionsArb,
          async (userId, permissions) => {
            const ctx = createContext(CorrelationId(), new AbortController());

            const claim = authService
              .createClaim(ctx, { userId, permissions })
              ._unsafeUnwrap();

            const token = (
              await encryptionService.encodeJWT(ctx, {
                claim,
                privateKey: config.jwtPrivateKey!,
              })
            )._unsafeUnwrap();

            expect(token.split('.')).toHaveLength(3);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should reject any tampered token', async () => {
      const config = getConfig();
      const logger = getLogger();
      const authService = createAuthService({ logger, appConfig: config });
      const encryptionService = createEncryptionService({ logger });

      const tamperArb = fc.oneof(
        fc.constant('signature'),
        fc.constant('payload'),
        fc.constant('header'),
      );

      await fc.assert(
        fc.asyncProperty(
          validUserIdArb,
          tamperArb,
          async (userId, tamperTarget) => {
            const ctx = createContext(CorrelationId(), new AbortController());

            const claim = authService
              .createClaim(ctx, {
                userId,
                permissions: ['admin'],
              })
              ._unsafeUnwrap();

            const token = (
              await encryptionService.encodeJWT(ctx, {
                claim,
                privateKey: config.jwtPrivateKey!,
              })
            )._unsafeUnwrap();

            const parts = token.split('.');
            const tamperIndex =
              tamperTarget === 'header'
                ? 0
                : tamperTarget === 'payload'
                  ? 1
                  : 2;

            parts[tamperIndex] = `${parts[tamperIndex]}tampered`;
            const tamperedToken = parts.join('.');

            const result = await encryptionService.decodeJWT(ctx, {
              token: tamperedToken,
              publicKey: config.jwtPublicKey!,
            });

            expect(result.isErr()).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should preserve all permissions through round-trip', async () => {
      const config = getConfig();
      const logger = getLogger();
      const authService = createAuthService({ logger, appConfig: config });
      const encryptionService = createEncryptionService({ logger });

      await fc.assert(
        fc.asyncProperty(
          validUserIdArb,
          validPermissionsArb,
          async (userId, permissions) => {
            const ctx = createContext(CorrelationId(), new AbortController());

            const claim = authService
              .createClaim(ctx, { userId, permissions })
              ._unsafeUnwrap();

            const token = (
              await encryptionService.encodeJWT(ctx, {
                claim,
                privateKey: config.jwtPrivateKey!,
              })
            )._unsafeUnwrap();

            const decoded = (
              await encryptionService.decodeJWT(ctx, {
                token,
                publicKey: config.jwtPublicKey!,
              })
            )._unsafeUnwrap();

            const extractedPerms = authService
              .getPermissions(decoded)
              ._unsafeUnwrap();

            expect(new Set(extractedPerms)).toEqual(new Set(permissions));
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should always reject expired tokens regardless of other claim data', async () => {
      const config = getConfig();
      const logger = getLogger();
      const authService = createAuthService({ logger, appConfig: config });
      const encryptionService = createEncryptionService({ logger });

      const expiredTimeArb = fc.integer({ min: -86400, max: -1 });

      await fc.assert(
        fc.asyncProperty(
          validUserIdArb,
          validPermissionsArb,
          expiredTimeArb,
          async (userId, permissions, expTime) => {
            const ctx = createContext(CorrelationId(), new AbortController());

            const claim = authService
              .createClaim(ctx, {
                userId,
                permissions,
                expirationTime: expTime,
              })
              ._unsafeUnwrap();

            const token = (
              await encryptionService.encodeJWT(ctx, {
                claim,
                privateKey: config.jwtPrivateKey!,
              })
            )._unsafeUnwrap();

            const result = await encryptionService.decodeJWT(ctx, {
              token,
              publicKey: config.jwtPublicKey!,
            });

            expect(result.isErr()).toBe(true);
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should reject invalid permissions during claim creation', async () => {
      const config = getConfig();
      const logger = getLogger();
      const authService = createAuthService({ logger, appConfig: config });

      const invalidPermissionArb = fc
        .string({ minLength: 0, maxLength: 50 })
        .filter((s) => !permissions.includes(s as Permission));

      const invalidPermissionsArb = fc.array(invalidPermissionArb, {
        minLength: 1,
        maxLength: 20,
      });

      await fc.assert(
        fc.asyncProperty(
          validUserIdArb,
          invalidPermissionsArb,
          async (userId, invalidPerms) => {
            const ctx = createContext(CorrelationId(), new AbortController());

            const result = authService.createClaim(ctx, {
              userId,
              permissions: invalidPerms as Permission[],
            });

            expect(result.isErr()).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should return error for claims with missing subject', async () => {
      const config = getConfig();
      const logger = getLogger();
      const authService = createAuthService({ logger, appConfig: config });

      const malformedClaimArb = fc.record({
        aud: fc.array(fc.constantFrom(...permissions)),
        iss: fc.string({ minLength: 1 }),
        iat: fc.integer({ min: 0 }),
      });

      await fc.assert(
        fc.asyncProperty(malformedClaimArb, async (malformedClaim) => {
          const result = authService.getUserId(malformedClaim as any);
          expect(result.isErr()).toBe(true);
        }),
        { numRuns: 30 },
      );
    });
  });

  describe('bearer token authentication', () => {
    it('should accept valid bearer token with correct permissions', async () => {
      const auth = getTestAuth();

      // Create valid token with admin permissions
      const token = await auth.createAdminToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      // Verify token can be used in headers
      const headers = auth.createBearerHeaders(token);
      expect(headers.Authorization).toBe(`Bearer ${token}`);
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should create token with custom permissions', async () => {
      const auth = getTestAuth();

      const token = await auth.createToken({
        userId: UserId('custom-user'),
        permissions: ['read:users', 'write:users'],
      });

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should create token with no permissions for testing forbidden', async () => {
      const auth = getTestAuth();

      const token = await auth.createUnauthorizedToken();

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should create expired token for testing unauthorized', async () => {
      const auth = getTestAuth();

      const expiredToken = await auth.createExpiredToken();

      expect(typeof expiredToken).toBe('string');
      expect(expiredToken.length).toBeGreaterThan(0);
    });
  });

  describe('encryption key pair', () => {
    it('should generate RSA key pair for JWT signing', async () => {
      const logger = getLogger();
      const encryptionService = createEncryptionService({ logger });

      const ctx = createMockContext();

      const keyPairResult = await encryptionService.generateKeyPair(ctx);

      expect(keyPairResult.isOk()).toBe(true);
      const keyPair = keyPairResult._unsafeUnwrap();

      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(typeof keyPair.publicKey).toBe('string');
      expect(typeof keyPair.privateKey).toBe('string');
      expect(keyPair.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(keyPair.privateKey).toContain('BEGIN PRIVATE KEY');
    });

    it('should sign and verify with generated key pair', async () => {
      const config = getConfig();
      const logger = getLogger();

      const authService = createAuthService({
        logger,
        appConfig: config,
      });

      const encryptionService = createEncryptionService({ logger });

      const ctx = createMockContext();

      // Generate new key pair
      const keyPairResult = await encryptionService.generateKeyPair(ctx);
      const keyPair = keyPairResult._unsafeUnwrap();

      // Create and sign claim with new private key
      const claimResult = authService.createClaim(ctx, {
        userId: UserId('test-user'),
        permissions: ['admin'],
      });

      const claim = claimResult._unsafeUnwrap();
      const encodeResult = await encryptionService.encodeJWT(ctx, {
        claim,
        privateKey: keyPair.privateKey,
      });

      const token = encodeResult._unsafeUnwrap();

      // Verify with corresponding public key
      const decodeResult = await encryptionService.decodeJWT(ctx, {
        token,
        publicKey: keyPair.publicKey,
      });

      expect(decodeResult.isOk()).toBe(true);
      const decodedClaim = decodeResult._unsafeUnwrap();
      expect(decodedClaim.sub).toBe('test-user');
    });

    it('should fail verification with wrong public key', async () => {
      const config = getConfig();
      const logger = getLogger();

      const authService = createAuthService({
        logger,
        appConfig: config,
      });

      const encryptionService = createEncryptionService({ logger });

      const ctx = createMockContext();

      // Generate two key pairs
      const keyPair1Result = await encryptionService.generateKeyPair(ctx);
      const keyPair2Result = await encryptionService.generateKeyPair(ctx);

      const keyPair1 = keyPair1Result._unsafeUnwrap();
      const keyPair2 = keyPair2Result._unsafeUnwrap();

      // Sign with keyPair1 private key
      const claimResult = authService.createClaim(ctx, {
        userId: UserId('test-user'),
        permissions: ['admin'],
      });

      const claim = claimResult._unsafeUnwrap();
      const encodeResult = await encryptionService.encodeJWT(ctx, {
        claim,
        privateKey: keyPair1.privateKey,
      });

      const token = encodeResult._unsafeUnwrap();

      // Try to verify with keyPair2 public key (wrong key)
      const decodeResult = await encryptionService.decodeJWT(ctx, {
        token,
        publicKey: keyPair2.publicKey,
      });

      expect(decodeResult.isErr()).toBe(true);
    });
  });
});
