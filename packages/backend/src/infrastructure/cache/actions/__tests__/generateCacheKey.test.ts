import { describe, expect, it } from 'bun:test';
import { generateCacheKey } from '@backend/infrastructure/cache/actions/generateCacheKey';
import { type Id, newId } from '@core/domain/Id';
import { UserId } from '@core/domain/user/user';

type TestId = Id<'Test'>;
const TestId = newId<TestId>;

describe('generateCacheKey', () => {
  describe('shared cache keys (no userId)', () => {
    it('should generate shared key with namespace and id', () => {
      const namespace = 'users';
      const id = TestId('user-123');

      const key = generateCacheKey(namespace, id);

      expect(key).toBe('users/user-123');
    });

    it('should handle different namespaces', () => {
      const id = TestId('item-456');

      expect(generateCacheKey('integrations', id)).toBe(
        'integrations/item-456',
      );
      expect(generateCacheKey('secrets', id)).toBe('secrets/item-456');
      expect(generateCacheKey('custom-namespace', id)).toBe(
        'custom-namespace/item-456',
      );
    });

    it('should handle special characters in namespace', () => {
      const id = TestId('test-id');
      const namespace = 'my-namespace_v2';

      const key = generateCacheKey(namespace, id);

      expect(key).toBe('my-namespace_v2/test-id');
    });

    it('should handle special characters in id', () => {
      const namespace = 'users';
      const id = TestId('user:123:456');

      const key = generateCacheKey(namespace, id);

      expect(key).toBe('users/user:123:456');
    });
  });

  describe('standard cache keys (with userId)', () => {
    it('should generate user-scoped key with userId, namespace, and id', () => {
      const namespace = 'integrations';
      const id = TestId('integration-789');
      const userId = UserId('user-abc');

      const key = generateCacheKey(namespace, id, userId);

      expect(key).toBe('user/user-abc/integrations/integration-789');
    });

    it('should handle different userIds', () => {
      const namespace = 'secrets';
      const id = TestId('secret-123');

      const userId1 = UserId('user-1');
      const userId2 = UserId('user-2');
      const userId3 = UserId('admin-user');

      expect(generateCacheKey(namespace, id, userId1)).toBe(
        'user/user-1/secrets/secret-123',
      );
      expect(generateCacheKey(namespace, id, userId2)).toBe(
        'user/user-2/secrets/secret-123',
      );
      expect(generateCacheKey(namespace, id, userId3)).toBe(
        'user/admin-user/secrets/secret-123',
      );
    });

    it('should maintain consistent format for user-scoped keys', () => {
      const namespace = 'workflows';
      const id = TestId('workflow-xyz');
      const userId = UserId('user-999');

      const key = generateCacheKey(namespace, id, userId);

      expect(key).toStartWith('user/');
      expect(key).toContain(`/${userId}/`);
      expect(key).toContain(`/${namespace}/`);
      expect(key).toEndWith(`/${id}`);
    });

    it('should handle special characters in userId', () => {
      const namespace = 'data';
      const id = TestId('item-1');
      const userId = UserId('user:auth0:123');

      const key = generateCacheKey(namespace, id, userId);

      expect(key).toBe('user/user:auth0:123/data/item-1');
    });
  });

  describe('key format consistency', () => {
    it('should generate different keys for shared vs standard with same namespace and id', () => {
      const namespace = 'items';
      const id = TestId('item-123');
      const userId = UserId('user-1');

      const sharedKey = generateCacheKey(namespace, id);
      const standardKey = generateCacheKey(namespace, id, userId);

      expect(sharedKey).toBe('items/item-123');
      expect(standardKey).toBe('user/user-1/items/item-123');
      expect(sharedKey).not.toBe(standardKey);
    });

    it('should always use forward slashes as delimiters', () => {
      const namespace = 'test';
      const id = TestId('id-1');
      const userId = UserId('user-1');

      const sharedKey = generateCacheKey(namespace, id);
      const standardKey = generateCacheKey(namespace, id, userId);

      expect(sharedKey.split('/').length).toBe(2);
      expect(standardKey.split('/').length).toBe(4);
    });

    it('should generate unique keys for different ids in same namespace', () => {
      const namespace = 'users';
      const id1 = TestId('user-1');
      const id2 = TestId('user-2');

      const key1 = generateCacheKey(namespace, id1);
      const key2 = generateCacheKey(namespace, id2);

      expect(key1).not.toBe(key2);
      expect(key1).toBe('users/user-1');
      expect(key2).toBe('users/user-2');
    });
  });
});
