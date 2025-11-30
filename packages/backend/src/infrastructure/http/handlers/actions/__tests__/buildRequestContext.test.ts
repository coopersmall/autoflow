import { describe, expect, it } from 'bun:test';
import { buildRequestContext } from '@backend/infrastructure/http/handlers/actions/buildRequestContext';
import { getMockRequest } from '@backend/infrastructure/http/handlers/domain/__mocks__/Request.mock';
import { CorrelationId } from '@core/domain/CorrelationId';
import {
  type UsersSession,
  UsersSessionId,
} from '@core/domain/session/UsersSession';
import { UserId } from '@core/domain/user/user';

describe('buildRequestContext', () => {
  const createMockSession = (): UsersSession => ({
    schemaVersion: 1,
    id: UsersSessionId(),
    createdAt: new Date(),
    userId: UserId('test-user'),
    permissions: ['read:users'],
  });

  it('should build context with correlation ID', () => {
    const correlationId = CorrelationId('test-correlation-123');
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
    });

    const context = buildRequestContext({
      correlationId,
      request: mockRequest,
    });

    expect(context.correlationId).toBe(correlationId);
  });

  it('should include session when provided in request.context', () => {
    const correlationId = CorrelationId('test-id');
    const mockSession = createMockSession();
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
      context: {
        userSession: mockSession,
      },
    });

    const context = buildRequestContext({
      correlationId,
      request: mockRequest,
    });

    expect(context.session).toEqual(mockSession);
  });

  it('session should be undefined when not in request.context.userSession', () => {
    const correlationId = CorrelationId('test-id');
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
      context: {},
    });

    const context = buildRequestContext({
      correlationId,
      request: mockRequest,
    });

    expect(context.session).toBeUndefined();
  });

  it('should provide getParam function', () => {
    const correlationId = CorrelationId('test-id');
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/users/user-123',
      params: { id: 'user-123' },
    });

    const context = buildRequestContext({
      correlationId,
      request: mockRequest,
    });

    expect(typeof context.getParam).toBe('function');
  });

  it('should provide getSearchParam function', () => {
    const correlationId = CorrelationId('test-id');
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test?page=2',
    });

    const context = buildRequestContext({
      correlationId,
      request: mockRequest,
    });

    expect(typeof context.getSearchParam).toBe('function');
  });

  it('should provide getBody function', () => {
    const correlationId = CorrelationId('test-id');
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
    });

    const context = buildRequestContext({
      correlationId,
      request: mockRequest,
    });

    expect(typeof context.getBody).toBe('function');
  });

  it('should provide getHeader function', () => {
    const correlationId = CorrelationId('test-id');
    const headers = new Headers({
      'content-type': 'application/json',
      authorization: 'Bearer token123',
    });
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
      headers,
    });

    const context = buildRequestContext({
      correlationId,
      request: mockRequest,
    });

    expect(typeof context.getHeader).toBe('function');
  });

  it('getHeader should return header value when present', () => {
    const correlationId = CorrelationId('test-id');
    const headers = new Headers({
      'content-type': 'application/json',
    });
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
      headers,
    });

    const context = buildRequestContext({
      correlationId,
      request: mockRequest,
    });

    const result = context.getHeader('content-type');

    expect(result).toBe('application/json');
  });

  it('getHeader should return undefined when header not present', () => {
    const correlationId = CorrelationId('test-id');
    const headers = new Headers();
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
      headers,
    });

    const context = buildRequestContext({
      correlationId,
      request: mockRequest,
    });

    const result = context.getHeader('x-custom-header');

    expect(result).toBeUndefined();
  });
});
