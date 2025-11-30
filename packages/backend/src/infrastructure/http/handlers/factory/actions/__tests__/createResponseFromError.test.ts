import { describe, expect, it } from 'bun:test';
import { createResponseFromError } from '@backend/infrastructure/http/handlers/factory/actions/createResponseFromError';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';

interface ErrorResponseBody {
  message: string;
  code: string;
}

describe('createResponseFromError', () => {
  it('should map BadRequest to 400', async () => {
    const error = new ErrorWithMetadata('Bad request', 'BadRequest');
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
    const error = new ErrorWithMetadata('Unauthorized', 'Unauthorized');
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
    const error = new ErrorWithMetadata('Forbidden', 'Forbidden');
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
    const error = new ErrorWithMetadata('Not found', 'NotFound');
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
    const error = new ErrorWithMetadata('Request timeout', 'Timeout');
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
    const error = new ErrorWithMetadata('Too many requests', 'TooManyRequests');
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
    const error = new ErrorWithMetadata(
      'Internal server error',
      'InternalServer',
    );
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
    const error = new ErrorWithMetadata('Gateway timeout', 'GatewayTimeout');
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
    const error = new ErrorWithMetadata(
      'Custom error message',
      'InternalServer',
    );
    const response = createResponseFromError(error);

    const body: ErrorResponseBody = await response.json();
    expect(body.message).toBe('Custom error message');
  });

  it('should include error code in response body', async () => {
    const error = new ErrorWithMetadata('Error occurred', 'BadRequest');
    const response = createResponseFromError(error);

    const body: ErrorResponseBody = await response.json();
    expect(body.code).toBe('BadRequest');
  });

  it('should set content-type to application/json', () => {
    const error = new ErrorWithMetadata('Error', 'InternalServer');
    const response = createResponseFromError(error);

    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});
