import { describe, expect, it } from 'bun:test';
import {
  createHttpServerClientError,
  createHttpServerError,
  createHttpServerStartError,
} from '@backend/infrastructure/http/server/errors/HttpServerError';

describe('HttpServerError', () => {
  describe('createHttpServerError', () => {
    it('should create error with Error instance', () => {
      const originalError = new Error('Something went wrong');
      const error = createHttpServerError(originalError, {
        serverType: 'bun',
      });

      expect(error.message).toBe('Something went wrong');
      expect(error.code).toBe('InternalServer');
      expect(error.metadata.serverType).toBe('bun');
      expect(error.metadata.cause).toBe(originalError);
    });

    it('should create error with unknown error', () => {
      const error = createHttpServerError('string error', { port: 3000 });

      expect(error.message).toBe('HTTP server error');
      expect(error.code).toBe('InternalServer');
      expect(error.metadata.port).toBe(3000);
      expect(error.metadata.cause).toBeUndefined();
    });

    it('should create error without metadata', () => {
      const originalError = new Error('Test error');
      const error = createHttpServerError(originalError);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('InternalServer');
      expect(error.metadata.cause).toBe(originalError);
    });
  });

  describe('createHttpServerClientError', () => {
    it('should create client error with Error instance', () => {
      const originalError = new Error('Client failed');
      const error = createHttpServerClientError(originalError, {
        clientType: 'bun',
      });

      expect(error.message).toBe('Client failed');
      expect(error.code).toBe('InternalServer');
      expect(error.metadata.clientType).toBe('bun');
      expect(error.metadata.cause).toBe(originalError);
    });

    it('should create client error with unknown error', () => {
      const error = createHttpServerClientError(null, { operation: 'start' });

      expect(error.message).toBe('HTTP server client error');
      expect(error.code).toBe('InternalServer');
      expect(error.metadata.operation).toBe('start');
    });
  });

  describe('createHttpServerStartError', () => {
    it('should create start error with Error instance', () => {
      const originalError = new Error('Port already in use');
      const error = createHttpServerStartError(originalError, { port: 8080 });

      expect(error.message).toBe('Port already in use');
      expect(error.code).toBe('InternalServer');
      expect(error.metadata.port).toBe(8080);
      expect(error.metadata.cause).toBe(originalError);
    });

    it('should create start error with unknown error', () => {
      const error = createHttpServerStartError({ code: 'EADDRINUSE' });

      expect(error.message).toBe('Failed to start HTTP server');
      expect(error.code).toBe('InternalServer');
    });

    it('should merge metadata correctly', () => {
      const originalError = new Error('Config invalid');
      const error = createHttpServerStartError(originalError, {
        port: 3000,
        serverType: 'bun',
      });

      expect(error.metadata.port).toBe(3000);
      expect(error.metadata.serverType).toBe('bun');
      expect(error.metadata.cause).toBe(originalError);
    });
  });
});
