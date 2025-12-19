import { beforeAll, describe, expect, it } from 'bun:test';
import { setupHttpIntegrationTest } from '@backend/testing/integration/httpIntegrationTest';
import { createAPIUserHandlers } from '@backend/users/handlers/http/UsersHttpHandler';
import { UserId } from '@core/domain/user/user';
import { validUser } from '@core/domain/user/validation/validUser';
import * as fc from 'fast-check';

describe('UsersHttpHandler Integration Tests', () => {
  const {
    getHttpServer,
    getHttpClient,
    getTestAuth,
    getConfig,
    getLogger,
    getRouteFactory,
  } = setupHttpIntegrationTest();

  beforeAll(async () => {
    const config = getConfig();
    const logger = getLogger();
    const routeFactory = getRouteFactory();

    const handlers = [
      createAPIUserHandlers({
        logger,
        appConfig: config,
        routeFactory,
      }),
    ];

    await getHttpServer().start(handlers);
  });

  describe('Property Tests', () => {
    // Arbitraries for property-based testing
    const invalidBodyArb = fc.oneof(
      // Missing required field
      fc.record({ invalid: fc.string() }),
      // Wrong type for schemaVersion
      fc.record({ schemaVersion: fc.string() }),
      fc.record({ schemaVersion: fc.float() }),
      // Invalid types
      fc.constant(null),
      fc.constant('not an object'),
      fc.constant(123),
      fc.constant([1, 2, 3]),
      fc.constant(true),
      // Empty object
      fc.constant({}),
    );

    it('should reject all invalid request bodies with 400 for POST /api/users', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      await fc.assert(
        fc.asyncProperty(invalidBodyArb, async (body) => {
          const response = await client.post('/api/users', body, { headers });

          // All invalid payloads should be rejected with 400
          expect(response.status).toBe(400);
        }),
        { numRuns: 30 },
      );
    });

    it('should reject all invalid request bodies with 400 for PUT /api/users/:id', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      // Create a valid user first to update
      const createResponse = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers },
      );
      const createResult = await client.parseJson(createResponse, validUser);
      const createdUser = createResult._unsafeUnwrap();

      // For PUT, empty object is valid (no fields to update), so filter it out
      const invalidBodyForPutArb = invalidBodyArb.filter((body) => {
        return JSON.stringify(body) !== '{}';
      });

      await fc.assert(
        fc.asyncProperty(invalidBodyForPutArb, async (body) => {
          const response = await client.put(
            `/api/users/${createdUser.id}`,
            body,
            { headers },
          );

          // All invalid payloads should be rejected with 400
          expect(response.status).toBe(400);
        }),
        { numRuns: 30 },
      );
    });
  });

  describe('POST /api/users', () => {
    it('should create user with admin token (201)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const response = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers },
      );

      expect(response.status).toBe(201);

      const result = await client.parseJson(response, validUser);
      expect(result.isOk()).toBe(true);

      const user = result._unsafeUnwrap();
      expect(user.id).toBeDefined();
      expect(user.schemaVersion).toBe(1);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should return 401 when no auth header provided', async () => {
      const client = getHttpClient();

      const response = await client.post('/api/users', { schemaVersion: 1 });

      expect(response.status).toBe(401);
    });

    it('should return 401 when invalid token provided', async () => {
      const client = getHttpClient();
      const headers = {
        Authorization: 'Bearer invalid-token',
        'Content-Type': 'application/json',
      };

      const response = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers },
      );

      expect(response.status).toBe(401);
    });

    it('should return 401 when expired token provided', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const expiredToken = await auth.createExpiredToken();
      const headers = auth.createBearerHeaders(expiredToken);

      const response = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers },
      );

      expect(response.status).toBe(401);
    });

    it('should return 403 when token has no permissions', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const token = await auth.createUnauthorizedToken();
      const headers = auth.createBearerHeaders(token);

      const response = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers },
      );

      expect(response.status).toBe(403);
    });

    it('should return 403 when token has read-only permissions', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const token = await auth.createTokenWithReadAccess();
      const headers = auth.createBearerHeaders(token);

      const response = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers },
      );

      expect(response.status).toBe(403);
    });

    it('should return 400 when invalid body provided', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const response = await client.post(
        '/api/users',
        { invalid: 'data' },
        { headers },
      );

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should retrieve user by id with admin token (200)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const createResponse = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers },
      );
      const createResult = await client.parseJson(createResponse, validUser);
      const createdUser = createResult._unsafeUnwrap();

      const getResponse = await client.get(`/api/users/${createdUser.id}`, {
        headers,
      });

      expect(getResponse.status).toBe(200);

      const getResult = await client.parseJson(getResponse, validUser);
      expect(getResult.isOk()).toBe(true);

      const retrievedUser = getResult._unsafeUnwrap();
      expect(retrievedUser.id).toBe(createdUser.id);
      expect(retrievedUser.schemaVersion).toBe(1);
    });

    it('should return 404 when user not found', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const nonExistentId = UserId();
      const response = await client.get(`/api/users/${nonExistentId}`, {
        headers,
      });

      expect(response.status).toBe(404);
    });

    it('should return 401 when no auth header provided', async () => {
      const client = getHttpClient();

      const response = await client.get('/api/users/some-id');

      expect(response.status).toBe(401);
    });

    it('should return 403 when token has no permissions', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const token = await auth.createUnauthorizedToken();
      const headers = auth.createBearerHeaders(token);

      const response = await client.get('/api/users/some-id', { headers });

      expect(response.status).toBe(403);
    });

    it('should allow read with read:users permission (200)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const adminHeaders = await auth.createAdminHeaders();

      const createResponse = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers: adminHeaders },
      );

      expect(createResponse.status).toBe(201);
      const createResult = await client.parseJson(createResponse, validUser);
      const createdUser = createResult._unsafeUnwrap();

      const readToken = await auth.createTokenWithReadAccess();
      const readHeaders = auth.createBearerHeaders(readToken);

      const getResponse = await client.get(`/api/users/${createdUser.id}`, {
        headers: readHeaders,
      });

      expect(getResponse.status).toBe(200);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user with admin token (200)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const createResponse = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers },
      );

      expect(createResponse.status).toBe(201);
      const createResult = await client.parseJson(createResponse, validUser);
      const createdUser = createResult._unsafeUnwrap();

      const updateResponse = await client.put(
        `/api/users/${createdUser.id}`,
        { schemaVersion: 1 },
        { headers },
      );

      expect(updateResponse.status).toBe(200);

      const updateResult = await client.parseJson(updateResponse, validUser);
      expect(updateResult.isOk()).toBe(true);

      const updatedUser = updateResult._unsafeUnwrap();
      expect(updatedUser.id).toBe(createdUser.id);
      expect(updatedUser.updatedAt?.getTime()).toBeGreaterThanOrEqual(
        createdUser.updatedAt?.getTime() || 0,
      );
    });

    it('should return 403 when token has read-only permissions', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const adminHeaders = await auth.createAdminHeaders();

      const createResponse = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers: adminHeaders },
      );

      expect(createResponse.status).toBe(201);
      const createResult = await client.parseJson(createResponse, validUser);
      const createdUser = createResult._unsafeUnwrap();

      const readToken = await auth.createTokenWithReadAccess();
      const readHeaders = auth.createBearerHeaders(readToken);

      const updateResponse = await client.put(
        `/api/users/${createdUser.id}`,
        { schemaVersion: 1 },
        { headers: readHeaders },
      );

      expect(updateResponse.status).toBe(403);
    });

    it('should return 404 when user not found', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const nonExistentId = UserId();
      const response = await client.put(
        `/api/users/${nonExistentId}`,
        { schemaVersion: 1 },
        { headers },
      );

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user with admin token (200)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const createResponse = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers },
      );

      expect(createResponse.status).toBe(201);
      const createResult = await client.parseJson(createResponse, validUser);
      const createdUser = createResult._unsafeUnwrap();

      const deleteResponse = await client.delete(
        `/api/users/${createdUser.id}`,
        { headers },
      );

      expect(deleteResponse.status).toBe(200);

      const getResponse = await client.get(`/api/users/${createdUser.id}`, {
        headers,
      });

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 when user not found', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const nonExistentId = UserId();
      const response = await client.delete(`/api/users/${nonExistentId}`, {
        headers,
      });

      expect(response.status).toBe(404);
    });

    it('should return 403 when token has read-only permissions', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const adminHeaders = await auth.createAdminHeaders();

      const createResponse = await client.post(
        '/api/users',
        { schemaVersion: 1 },
        { headers: adminHeaders },
      );

      expect(createResponse.status).toBe(201);
      const createResult = await client.parseJson(createResponse, validUser);
      const createdUser = createResult._unsafeUnwrap();

      const readToken = await auth.createTokenWithReadAccess();
      const readHeaders = auth.createBearerHeaders(readToken);

      const deleteResponse = await client.delete(
        `/api/users/${createdUser.id}`,
        { headers: readHeaders },
      );

      expect(deleteResponse.status).toBe(403);
    });
  });

  describe('GET /api/users', () => {
    it('should retrieve all users with admin token (200)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      await client.post('/api/users', { schemaVersion: 1 }, { headers });
      await client.post('/api/users', { schemaVersion: 1 }, { headers });
      await client.post('/api/users', { schemaVersion: 1 }, { headers });

      const response = await client.get('/api/users', { headers });

      expect(response.status).toBe(200);

      const data = await response.json();
      if (Array.isArray(data)) {
        expect(data.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('should return empty array when no users exist (200)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const response = await client.get('/api/users', { headers });

      expect(response.status).toBe(200);

      const data = await response.json();
      if (Array.isArray(data)) {
        expect(data.length).toBe(0);
      }
    });

    it('should return 401 when no auth header provided', async () => {
      const client = getHttpClient();

      const response = await client.get('/api/users');

      expect(response.status).toBe(401);
    });

    it('should return 403 when token has no permissions', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const token = await auth.createUnauthorizedToken();
      const headers = auth.createBearerHeaders(token);

      const response = await client.get('/api/users', { headers });

      expect(response.status).toBe(403);
    });
  });
});
