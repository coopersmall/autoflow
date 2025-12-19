import { describe, expect, it } from 'bun:test';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { getMockRequest } from '@backend/infrastructure/http/handlers/domain/__mocks__/Request.mock';
import { runMiddleware } from '@backend/infrastructure/http/handlers/factory/actions/runMiddleware';
import { getMockMiddleware } from '@backend/infrastructure/http/handlers/middleware/__mocks__/HttpMiddleware.mock';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import { CorrelationId } from '@core/domain/CorrelationId';
import { forbidden, unauthorized } from '@core/errors';

describe('runMiddleware', () => {
  it('should run multiple middlewares in order', async () => {
    const logger = getMockedLogger();
    const mockRequest = getMockRequest({
      ctx: createMockContext({ correlationId: CorrelationId('test-id') }),
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

  it('should stop execution on first middleware error', async () => {
    const logger = getMockedLogger();
    const mockRequest = getMockRequest({
      ctx: createMockContext({ correlationId: CorrelationId('test-id') }),
    });

    const error = unauthorized('Auth failed');
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
  });

  it('should return error from failed middleware', async () => {
    const logger = getMockedLogger();
    const mockRequest = getMockRequest({
      ctx: createMockContext({ correlationId: CorrelationId('test-id') }),
    });

    const error = forbidden('Permission denied');
    const errorMiddleware = getMockMiddleware('error', error);

    const result = await runMiddleware(
      { logger },
      { middlewares: [errorMiddleware], request: mockRequest },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Permission denied');
      expect(result.error.code).toBe('Forbidden');
    }
  });
});
