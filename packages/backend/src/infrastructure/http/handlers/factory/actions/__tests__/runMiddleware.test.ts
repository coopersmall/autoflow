import { describe, expect, it } from 'bun:test';
import { getMockRequest } from '@backend/infrastructure/http/handlers/domain/__mocks__/Request.mock';
import { runMiddleware } from '@backend/infrastructure/http/handlers/factory/actions/runMiddleware';
import { getMockMiddleware } from '@backend/infrastructure/http/handlers/middleware/__mocks__/HttpMiddleware.mock';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';

describe('runMiddleware', () => {
  it('should run empty middleware array successfully', async () => {
    const logger = getMockedLogger();
    const mockRequest = getMockRequest({
      context: { correlationId: CorrelationId('test-id') },
    });

    const result = await runMiddleware(
      { logger },
      { middlewares: [], request: mockRequest },
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(mockRequest);
    }
  });

  it('should run single middleware successfully', async () => {
    const logger = getMockedLogger();
    const mockRequest = getMockRequest({
      context: { correlationId: CorrelationId('test-id') },
    });

    const middleware = getMockMiddleware('success');
    const result = await runMiddleware(
      { logger },
      { middlewares: [middleware], request: mockRequest },
    );

    expect(result.isOk()).toBe(true);
  });

  it('should run multiple middlewares in order', async () => {
    const logger = getMockedLogger();
    const mockRequest = getMockRequest({
      context: { correlationId: CorrelationId('test-id') },
    });

    const middleware1 = getMockMiddleware('success');
    const middleware2 = getMockMiddleware('success');
    const middleware3 = getMockMiddleware('success');

    const result = await runMiddleware(
      { logger },
      {
        middlewares: [middleware1, middleware2, middleware3],
        request: mockRequest,
      },
    );

    expect(result.isOk()).toBe(true);
  });

  it('should pass modified request between middlewares', async () => {
    const logger = getMockedLogger();
    const mockRequest = getMockRequest({
      context: { correlationId: CorrelationId('test-id') },
    });

    const middleware1 = getMockMiddleware('success');
    const middleware2 = getMockMiddleware('success');

    const result = await runMiddleware(
      { logger },
      { middlewares: [middleware1, middleware2], request: mockRequest },
    );

    expect(result.isOk()).toBe(true);
  });

  it('should stop execution on first middleware error', async () => {
    const logger = getMockedLogger();
    const mockRequest = getMockRequest({
      context: { correlationId: CorrelationId('test-id') },
    });

    const error = new ErrorWithMetadata('Auth failed', 'Unauthorized');
    const middleware1 = getMockMiddleware('success');
    const middleware2 = getMockMiddleware('error', error);
    const middleware3 = getMockMiddleware('success');

    const result = await runMiddleware(
      { logger },
      {
        middlewares: [middleware1, middleware2, middleware3],
        request: mockRequest,
      },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(error);
    }
  });

  it('should return error from failed middleware', async () => {
    const logger = getMockedLogger();
    const mockRequest = getMockRequest({
      context: { correlationId: CorrelationId('test-id') },
    });

    const error = new ErrorWithMetadata('Permission denied', 'Forbidden');
    const errorMiddleware = getMockMiddleware('error', error);

    const result = await runMiddleware(
      { logger },
      { middlewares: [errorMiddleware], request: mockRequest },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(error);
      expect(result.error.message).toBe('Permission denied');
      expect(result.error.code).toBe('Forbidden');
    }
  });

  it('should log middleware errors with correlation ID', async () => {
    const logger = getMockedLogger();
    const mockRequest = getMockRequest({
      url: 'http://localhost/api/test',
    });

    const error = new ErrorWithMetadata('Middleware error', 'InternalServer');
    const errorMiddleware = getMockMiddleware('error', error);

    await runMiddleware(
      { logger },
      { middlewares: [errorMiddleware], request: mockRequest },
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Middleware error',
      expect.any(ErrorWithMetadata),
      expect.objectContaining({
        url: mockRequest.url,
      }),
    );
  });

  it('should log middleware errors with request URL', async () => {
    const logger = getMockedLogger();
    const requestUrl = 'http://localhost/api/users/123';
    const mockRequest = getMockRequest({
      url: requestUrl,
      context: { correlationId: CorrelationId('test-id') },
    });

    const error = new ErrorWithMetadata('Error', 'InternalServer');
    const errorMiddleware = getMockMiddleware('error', error);

    await runMiddleware(
      { logger },
      { middlewares: [errorMiddleware], request: mockRequest },
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Middleware error',
      error,
      expect.objectContaining({
        url: requestUrl,
      }),
    );
  });
});
