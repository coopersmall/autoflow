import { describe, expect, it } from 'bun:test';
import { extractCorrelationId } from '@backend/http/handlers/actions/extractCorrelationId';

describe('extractCorrelationId', () => {
  it('should extract correlation ID from x-correlation-id header', () => {
    const headers = new Headers({
      'x-correlation-id': 'test-correlation-123',
    });

    const result = extractCorrelationId({ headers });

    expect(String(result)).toBe('test-correlation-123');
  });

  it('should extract correlation ID from X-Correlation-ID header (case insensitive)', () => {
    const headers = new Headers({
      'X-Correlation-ID': 'TEST-CORRELATION-456',
    });

    const result = extractCorrelationId({ headers });

    expect(String(result)).toBe('TEST-CORRELATION-456');
  });

  it('should generate new correlation ID if header is missing', () => {
    const headers = new Headers();

    const result = extractCorrelationId({ headers });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should generate new correlation ID if header value is empty', () => {
    const headers = new Headers({
      'x-correlation-id': '',
    });

    const result = extractCorrelationId({ headers });

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(String(result)).not.toBe('');
  });
});
