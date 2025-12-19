import { describe, expect, it } from 'bun:test';
import { createResponseFromError } from '@backend/infrastructure/http/handlers/factory/actions/createResponseFromError';
import {
  badRequest,
  forbidden,
  gatewayTimeout,
  internalError,
  notFound,
  timeout,
  tooManyRequests,
  unauthorized,
} from '@core/errors';

interface ErrorResponseBody {
  message: string;
  code: string;
}

describe('createResponseFromError', () => {
  it('should map BadRequest to 400', async () => {
    const error = badRequest('Bad request');
    const response = createResponseFromError(error);

    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body).toEqual({
      message: 'Bad request',
      code: 'BadRequest',
    });
  });

  it('should map Unauthorized to 401', async () => {
    const error = unauthorized('Unauthorized');
    const response = createResponseFromError(error);

    expect(response.status).toBe(401);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body).toEqual({
      message: 'Unauthorized',
      code: 'Unauthorized',
    });
  });

  it('should map Forbidden to 403', async () => {
    const error = forbidden('Forbidden');
    const response = createResponseFromError(error);

    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body).toEqual({
      message: 'Forbidden',
      code: 'Forbidden',
    });
  });

  it('should map NotFound to 404', async () => {
    const error = notFound('Not found');
    const response = createResponseFromError(error);

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body).toEqual({
      message: 'Not found',
      code: 'NotFound',
    });
  });

  it('should map Timeout to 408', async () => {
    const error = timeout('Request timeout');
    const response = createResponseFromError(error);

    expect(response.status).toBe(408);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body).toEqual({
      message: 'Request timeout',
      code: 'Timeout',
    });
  });

  it('should map TooManyRequests to 429', async () => {
    const error = tooManyRequests('Too many requests');
    const response = createResponseFromError(error);

    expect(response.status).toBe(429);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body).toEqual({
      message: 'Too many requests',
      code: 'TooManyRequests',
    });
  });

  it('should map InternalServer to 500', async () => {
    const error = internalError('Internal server error');
    const response = createResponseFromError(error);

    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body).toEqual({
      message: 'Internal server error',
      code: 'InternalServer',
    });
  });

  it('should map GatewayTimeout to 504', async () => {
    const error = gatewayTimeout('Gateway timeout');
    const response = createResponseFromError(error);

    expect(response.status).toBe(504);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body).toEqual({
      message: 'Gateway timeout',
      code: 'GatewayTimeout',
    });
  });

  it('should include error message in response body', async () => {
    const error = internalError('Custom error message');
    const response = createResponseFromError(error);

    const body: ErrorResponseBody = await response.json();
    expect(body.message).toBe('Custom error message');
  });

  it('should include error code in response body', async () => {
    const error = badRequest('Error occurred');
    const response = createResponseFromError(error);

    const body: ErrorResponseBody = await response.json();
    expect(body.code).toBe('BadRequest');
  });

  it('should set content-type to application/json', () => {
    const error = internalError('Error');
    const response = createResponseFromError(error);

    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});
