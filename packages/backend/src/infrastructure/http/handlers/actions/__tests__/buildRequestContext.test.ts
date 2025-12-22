import { describe, expect, it } from 'bun:test';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { buildRequestContext } from '@backend/infrastructure/http/handlers/actions/buildRequestContext';
import { getMockRequest } from '@backend/infrastructure/http/handlers/domain/__mocks__/Request.mock';
import { CorrelationId } from '@core/domain/CorrelationId';
import { UserId } from '@core/domain/user/user';
import {
  type UsersSession,
  UsersSessionId,
} from '@core/domain/user-session/UsersSession';

describe('buildRequestContext', () => {
  const createMockSession = (): UsersSession => ({
    schemaVersion: 1,
    id: UsersSessionId(),
    createdAt: new Date(),
    userId: UserId('test-user'),
    permissions: ['read:users'],
  });

  it('should build context with correlation ID', () => {
    const ctx = createMockContext({
      correlationId: CorrelationId('test-correlation-123'),
    });
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
    });

    const context = buildRequestContext({
      ctx,
      request: mockRequest,
    });

    expect(context.ctx.correlationId).toBe(ctx.correlationId);
  });

  it('should include ctx property with Context', () => {
    const ctx = createMockContext({
      correlationId: CorrelationId('test-correlation-456'),
    });
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
    });

    const context = buildRequestContext({
      ctx,
      request: mockRequest,
    });

    expect(context.ctx).toBeDefined();
    expect(context.ctx.correlationId).toBe(ctx.correlationId);
    expect(context.ctx.signal).toBeDefined();
    expect(typeof context.ctx.cancel).toBe('function');
  });

  it('should include session when provided in request.context', () => {
    const ctx = createMockContext({
      correlationId: CorrelationId('test-id'),
    });
    const mockSession = createMockSession();
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
      userSession: mockSession,
    });

    const context = buildRequestContext({
      ctx,
      request: mockRequest,
    });

    expect(context.session).toEqual(mockSession);
  });

  it('session should be undefined when not in request.userSession', () => {
    const ctx = createMockContext({
      correlationId: CorrelationId('test-id'),
    });
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
      ctx,
    });

    const context = buildRequestContext({
      ctx,
      request: mockRequest,
    });

    expect(context.session).toBeUndefined();
  });

  it('should provide getParam function', () => {
    const ctx = createMockContext({
      correlationId: CorrelationId('test-id'),
    });
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/users/user-123',
      params: { id: 'user-123' },
      ctx,
    });

    const context = buildRequestContext({
      ctx,
      request: mockRequest,
    });

    expect(typeof context.getParam).toBe('function');
  });

  it('should provide getSearchParam function', () => {
    const ctx = createMockContext({
      correlationId: CorrelationId('test-id'),
    });
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test?page=2',
      ctx,
    });

    const context = buildRequestContext({
      ctx,
      request: mockRequest,
    });

    expect(typeof context.getSearchParam).toBe('function');
  });

  it('should provide getBody function', () => {
    const ctx = createMockContext({
      correlationId: CorrelationId('test-id'),
    });
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
      ctx,
    });

    const context = buildRequestContext({
      ctx,
      request: mockRequest,
    });

    expect(typeof context.getBody).toBe('function');
  });

  it('should provide getHeader function', () => {
    const ctx = createMockContext({
      correlationId: CorrelationId('test-id'),
    });
    const headers = new Headers({
      'content-type': 'application/json',
      authorization: 'Bearer token123',
    });
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
      headers,
      ctx,
    });

    const context = buildRequestContext({
      ctx,
      request: mockRequest,
    });

    expect(typeof context.getHeader).toBe('function');
  });

  it('getHeader should return header value when present', () => {
    const ctx = createMockContext({
      correlationId: CorrelationId('test-id'),
    });
    const headers = new Headers({
      'content-type': 'application/json',
    });
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
      headers,
      ctx,
    });

    const context = buildRequestContext({
      ctx,
      request: mockRequest,
    });

    const result = context.getHeader('content-type');

    expect(result).toBe('application/json');
  });

  it('getHeader should return undefined when header not present', () => {
    const ctx = createMockContext({
      correlationId: CorrelationId('test-id'),
    });
    const headers = new Headers();
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
      headers,
      ctx,
    });

    const context = buildRequestContext({
      ctx,
      request: mockRequest,
    });

    const result = context.getHeader('x-custom-header');

    expect(result).toBeUndefined();
  });
});
