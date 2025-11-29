import { describe, expect, it } from 'bun:test';
import { extractAuthHeader } from '@backend/http/handlers/actions/extractAuthHeader';

describe('extractAuthHeader', () => {
  it('should extract Authorization header with Bearer token', () => {
    const headers = new Headers({
      Authorization: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
    });

    const result = extractAuthHeader({ headers });

    expect(result).toBe('Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...');
  });

  it('should extract Authorization header with Basic auth', () => {
    const headers = new Headers({
      Authorization: 'Basic dXNlcjpwYXNz',
    });

    const result = extractAuthHeader({ headers });

    expect(result).toBe('Basic dXNlcjpwYXNz');
  });

  it('should extract Authorization header (case insensitive)', () => {
    const headers = new Headers({
      authorization: 'Bearer token123',
    });

    const result = extractAuthHeader({ headers });

    expect(result).toBe('Bearer token123');
  });

  it('should return undefined when Authorization header is missing', () => {
    const headers = new Headers();

    const result = extractAuthHeader({ headers });

    expect(result).toBeUndefined();
  });

  it('should return empty string when Authorization header is empty', () => {
    const headers = new Headers({
      Authorization: '',
    });

    const result = extractAuthHeader({ headers });

    expect(result).toBe('');
  });

  it('should extract Authorization header with other headers present', () => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      Authorization: 'Bearer mytoken',
      'X-Custom-Header': 'custom-value',
    });

    const result = extractAuthHeader({ headers });

    expect(result).toBe('Bearer mytoken');
  });

  it('should handle multiple authorization schemes', () => {
    const headers = new Headers({
      Authorization: 'Digest username="user", realm="realm"',
    });

    const result = extractAuthHeader({ headers });

    expect(result).toBe('Digest username="user", realm="realm"');
  });
});
