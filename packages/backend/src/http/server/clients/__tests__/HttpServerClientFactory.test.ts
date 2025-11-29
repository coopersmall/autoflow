import { describe, expect, it } from 'bun:test';
import { createHttpServerClientFactory } from '@backend/http/server/clients/HttpServerClientFactory';

describe('HttpServerClientFactory', () => {
  describe('createHttpServerClientFactory', () => {
    it('should create factory instance', () => {
      const factory = createHttpServerClientFactory();
      expect(factory).toBeDefined();
      expect(typeof factory.getServerClient).toBe('function');
    });
  });

  describe('getServerClient', () => {
    it('should return Bun client for "bun" type', () => {
      const factory = createHttpServerClientFactory();
      const result = factory.getServerClient('bun');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const client = result.value;
        expect(client).toBeDefined();
        expect(typeof client.start).toBe('function');
      }
    });

    it('should create multiple clients independently', () => {
      const factory = createHttpServerClientFactory();

      const result1 = factory.getServerClient('bun');
      const result2 = factory.getServerClient('bun');

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      if (result1.isOk() && result2.isOk()) {
        expect(result1.value).not.toBe(result2.value);
      }
    });
  });
});
