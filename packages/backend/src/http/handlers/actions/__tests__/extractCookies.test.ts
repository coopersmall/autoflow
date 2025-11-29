import { describe, expect, it } from 'bun:test';
import { extractCookies } from '@backend/http/handlers/actions/extractCookies';
import { getMockCookieMap } from '@backend/http/handlers/domain/__mocks__/Cookies.mock';
import { getMockRequest } from '@backend/http/handlers/domain/__mocks__/Request.mock';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { CorrelationId } from '@core/domain/CorrelationId';

describe('extractCookies', () => {
  it('should extract cookies from request with cookies', () => {
    const logger = getMockedLogger();
    const correlationId = CorrelationId();
    const mockCookies = getMockCookieMap([
      ['auth', 'token123'],
      ['session', 'sess456'],
    ]);
    const request = getMockRequest({ cookies: mockCookies });
    const result = extractCookies({ logger }, { correlationId, request });

    expect(result?.get('auth')).toBe('token123');
    expect(result?.get('session')).toBe('sess456');
    expect(result?.size).toBe(2);
  });

  it('should return empty cookie map when request has no cookies', () => {
    const logger = getMockedLogger();
    const correlationId = CorrelationId();
    const cookies = getMockCookieMap([]);
    const request = getMockRequest({ cookies });

    const result = extractCookies({ logger }, { correlationId, request });

    expect(result?.get('auth')).toBeNull();
    expect(result?.size).toBe(0);
    expect(result?.toSetCookieHeaders()).toEqual([]);
  });

  it('should handle errors gracefully', () => {
    const logger = getMockedLogger();
    const correlationId = CorrelationId();
    const badRequest = getMockRequest();
    Object.defineProperty(badRequest, 'cookies', {
      get: () => {
        throw new Error('Cookie access error');
      },
    });

    const result = extractCookies(
      { logger },
      { correlationId, request: badRequest },
    );

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Error extracting cookies from request',
      expect.any(Error),
      expect.objectContaining({
        correlationId,
      }),
    );
  });
});
