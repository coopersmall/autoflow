import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { createRelationalDatabaseAdapter } from '@backend/repos/adapters/RelationalDatabaseAdapter';
import { getMockedDatabaseClientFactory } from '@backend/repos/clients/__mocks__/DatabaseClientFactory.mock';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { ValidationError } from '@core/errors/ValidationError';
import { err, ok } from 'neverthrow';

describe('RelationalDatabaseAdapter', () => {
  let mockDatabase: ReturnType<typeof mock>;
  let mockClientFactory: ReturnType<typeof getMockedDatabaseClientFactory>;
  let adapter: ReturnType<typeof createRelationalDatabaseAdapter>;
  const tableName = 'test_table';

  const createSqlCapturingMock = (mockResult: unknown[] = []) => {
    const sqlCalls: Array<{ strings: string[]; values: unknown[] }> = [];

    const sqlCapturingMock = mock((...args: unknown[]) => {
      if (args[0] && Array.isArray(args[0])) {
        sqlCalls.push({
          strings: [...args[0]],
          values: args.slice(1),
        });
        return Promise.resolve(mockResult);
      }
      return args[0];
    });

    return { sqlCapturingMock, sqlCalls };
  };

  const createErrorThrowingMock = (errorMessage: string) => {
    // Create a thenable that throws on await - this allows query chaining to work
    // but throws when the final result is awaited
    const createErrorThenable = () => ({
      // biome-ignore lint: We need to use thenable for promise-like behavior
      then: (_onFulfilled: unknown, onRejected?: (reason: Error) => void) => {
        if (onRejected) {
          return Promise.resolve(onRejected(new Error(errorMessage)));
        }
        return Promise.reject(new Error(errorMessage));
      },
    });

    return mock((...args: unknown[]) => {
      if (args[0] && Array.isArray(args[0])) {
        return createErrorThenable();
      }
      return args[0];
    });
  };

  const createClientMock = (
    createSqlCapturingMock: ReturnType<typeof mock>,
  ) => {
    return Object.assign(createSqlCapturingMock, {
      close: mock(),
    });
  };

  const createTestAdapter = (
    table: string,
    sqlMock: ReturnType<typeof mock>,
  ) => {
    const factory = getMockedDatabaseClientFactory();
    const client = createClientMock(sqlMock);
    factory.getDatabase.mockReturnValue(ok(client));
    return createRelationalDatabaseAdapter({
      clientFactory: factory,
      tableName: table,
      clientType: 'bun-sql',
    });
  };

  beforeEach(() => {
    mockDatabase = mock((...args: unknown[]) => {
      if (args[0] && Array.isArray(args[0])) {
        return Promise.resolve([
          {
            id: 'test-id',
            user_id: 'user-1',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            data: { test: 'data' },
          },
        ]);
      }
      return args[0];
    });

    const client = createClientMock(mockDatabase);

    mockClientFactory = getMockedDatabaseClientFactory();
    mockClientFactory.getDatabase.mockReturnValue(ok(client));

    adapter = createRelationalDatabaseAdapter({
      clientFactory: mockClientFactory,
      tableName,
      clientType: 'bun-sql',
    });
  });

  describe('findUnique()', () => {
    it('should return correct data and generate proper SQL with userId', async () => {
      const mockResult = [
        {
          id: 'user-123',
          user_id: 'owner-456',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          data: { name: 'Test User' },
        },
      ];

      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock(mockResult);

      const sqlCapturingAdapter = createTestAdapter('users', sqlCapturingMock);

      const result = await sqlCapturingAdapter.findUnique({
        where: { id: 'user-123', userId: 'owner-456' },
      });

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].id).toBe('user-123');
      expect(data[0].user_id).toBe('owner-456');

      expect(sqlCalls.length).toBe(3);

      const allValues = sqlCalls.flatMap((call) => call.values);
      expect(allValues).toContain('users');
      expect(allValues).toContain('user-123');
      expect(allValues).toContain('owner-456');

      const finalCall = sqlCalls[sqlCalls.length - 1];
      const finalSqlTemplate = finalCall.strings.join('PARAM');
      expect(finalSqlTemplate.toLowerCase()).toContain('limit');
    });

    it('should return correct data and generate proper SQL without userId', async () => {
      const mockResult = [
        {
          id: 'doc-456',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          data: { title: 'Shared Document' },
        },
      ];

      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock(mockResult);

      const sqlCapturingAdapter = createTestAdapter(
        'documents',
        sqlCapturingMock,
      );

      const result = await sqlCapturingAdapter.findUnique({
        where: { id: 'doc-456' },
      });

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].id).toBe('doc-456');
      expect(data[0].user_id).toBeUndefined();

      expect(sqlCalls.length).toBe(2);

      const allValues = sqlCalls.flatMap((call) => call.values);
      expect(allValues).toContain('documents');
      expect(allValues).toContain('doc-456');
      expect(allValues).not.toContain('owner-456');
    });

    it('should handle database connection errors', async () => {
      const errorMock = createErrorThrowingMock('Connection failed');
      const errorAdapter = createTestAdapter('test_table', errorMock);

      const result = await errorAdapter.findUnique({
        where: { id: 'test-id' },
      });

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      const error = result._unsafeUnwrapErr();
      expect(error).toBeInstanceOf(ErrorWithMetadata);
      expect(error.message).toBe('Connection failed');
    });

    it('should handle validation errors from malformed database responses', async () => {
      mockDatabase.mockResolvedValue('not-an-array');

      const result = await adapter.findUnique({
        where: { id: 'test-id' },
      });

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      const error = result._unsafeUnwrapErr();
      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  describe('findMany()', () => {
    it('should return correct data and generate proper SQL with userId and limit', async () => {
      const mockResult = [
        {
          id: 'post-1',
          user_id: 'user-789',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          data: { title: 'Post 1' },
        },
        {
          id: 'post-2',
          user_id: 'user-789',
          created_at: '2024-01-02T00:00:00.000Z',
          updated_at: '2024-01-02T00:00:00.000Z',
          data: { title: 'Post 2' },
        },
      ];

      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock(mockResult);

      const sqlCapturingAdapter = createTestAdapter('posts', sqlCapturingMock);

      const result = await sqlCapturingAdapter.findMany({
        where: { userId: 'user-789' },
        limit: 50,
      });

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].user_id).toBe('user-789');
      expect(data[1].user_id).toBe('user-789');

      expect(sqlCalls.length).toBe(3);

      const allValues = sqlCalls.flatMap((call) => call.values);
      expect(allValues).toContain('posts');
      expect(allValues).toContain('user-789');
      expect(allValues).toContain(50);
    });

    it('should return correct data and generate proper SQL with userId only', async () => {
      const mockResult = [
        {
          id: 'comment-1',
          user_id: 'user-123',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          data: { text: 'Great post!' },
        },
      ];

      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock(mockResult);

      const sqlCapturingAdapter = createTestAdapter(
        'comments',
        sqlCapturingMock,
      );

      const result = await sqlCapturingAdapter.findMany({
        where: { userId: 'user-123' },
      });

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(data).toHaveLength(1);
      expect(data[0].user_id).toBe('user-123');

      expect(sqlCalls.length).toBe(2);

      const allValues = sqlCalls.flatMap((call) => call.values);
      expect(allValues).toContain('comments');
      expect(allValues).toContain('user-123');
      expect(allValues).not.toContain(50);
    });

    it('should return correct data and generate proper SQL with limit only', async () => {
      const mockResult = [
        {
          id: 'item-1',
          created_at: '2024-01-01T00:00:00.000Z',
          data: { name: 'Item 1' },
        },
        {
          id: 'item-2',
          created_at: '2024-01-02T00:00:00.000Z',
          data: { name: 'Item 2' },
        },
      ];

      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock(mockResult);

      const sqlCapturingAdapter = createTestAdapter('items', sqlCapturingMock);

      const result = await sqlCapturingAdapter.findMany({
        limit: 10,
      });

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(data).toHaveLength(2);

      expect(sqlCalls.length).toBe(2);

      const allValues = sqlCalls.flatMap((call) => call.values);
      expect(allValues).toContain('items');
      expect(allValues).toContain(10);
      expect(allValues).not.toContain('user-123');
    });

    it('should return correct data and generate proper SQL without any filters', async () => {
      const mockResult = [
        {
          id: 'setting-1',
          created_at: '2024-01-01T00:00:00.000Z',
          data: { theme: 'dark' },
        },
      ];

      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock(mockResult);

      const sqlCapturingAdapter = createTestAdapter(
        'settings',
        sqlCapturingMock,
      );

      const result = await sqlCapturingAdapter.findMany();

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(data).toHaveLength(1);

      expect(sqlCalls.length).toBe(1);

      const allValues = sqlCalls.flatMap((call) => call.values);
      expect(allValues).toContain('settings');

      const sqlTemplate = sqlCalls[0].strings.join('PARAM');
      expect(sqlTemplate.toLowerCase()).toContain('select * from');
      expect(sqlTemplate.toLowerCase()).not.toContain('where');
      expect(sqlTemplate.toLowerCase()).not.toContain('limit');
    });

    it('should return empty array when no records found', async () => {
      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock([]);

      const sqlCapturingAdapter = createTestAdapter(
        'empty_table',
        sqlCapturingMock,
      );

      const result = await sqlCapturingAdapter.findMany();

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);

      expect(sqlCalls.length).toBe(1);
    });
  });

  describe('create()', () => {
    it('should return correct data and generate proper SQL with userId', async () => {
      const testDate = new Date('2024-01-01T00:00:00.000Z');
      const testData = { title: 'New Document' };

      const mockResult = [
        {
          id: 'new-doc',
          user_id: 'creator-123',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          data: testData,
        },
      ];

      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock(mockResult);

      const sqlCapturingAdapter = createTestAdapter(
        'documents',
        sqlCapturingMock,
      );

      const result = await sqlCapturingAdapter.create({
        id: 'new-doc',
        userId: 'creator-123',
        createdAt: testDate,
        data: testData,
      });

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(Array.isArray(data)).toBe(true);
      expect(data[0].id).toBe('new-doc');
      expect(data[0].user_id).toBe('creator-123');
      expect(data[0].data).toEqual(testData);

      expect(sqlCalls.length).toBe(1);

      const createCall = sqlCalls[0];
      const sqlTemplate = createCall.strings.join('PARAM');

      expect(sqlTemplate.toLowerCase()).toContain('insert into');
      expect(sqlTemplate.toLowerCase()).toContain(
        '(id, user_id, created_at, data)',
      );
      expect(sqlTemplate.toLowerCase()).toContain('values');
      expect(sqlTemplate.toLowerCase()).toContain('returning *');

      expect(createCall.values).toContain('documents');
      expect(createCall.values).toContain('new-doc');
      expect(createCall.values).toContain('creator-123');
      expect(createCall.values).toContain(testDate);
      expect(createCall.values).toContain(testData);
    });

    it('should return correct data and generate proper SQL without userId', async () => {
      const testDate = new Date('2024-01-01T00:00:00.000Z');
      const testData = { title: 'Shared Document' };

      const mockResult = [
        {
          id: 'shared-doc',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          data: testData,
        },
      ];

      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock(mockResult);

      const sqlCapturingAdapter = createTestAdapter(
        'shared_documents',
        sqlCapturingMock,
      );

      const result = await sqlCapturingAdapter.create({
        id: 'shared-doc',
        createdAt: testDate,
        data: testData,
      });

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(data[0].id).toBe('shared-doc');
      expect(data[0].user_id).toBeUndefined();
      expect(data[0].data).toEqual(testData);

      expect(sqlCalls.length).toBe(1);

      const createCall = sqlCalls[0];
      const sqlTemplate = createCall.strings.join('PARAM');

      expect(sqlTemplate.toLowerCase()).toContain('insert into');
      expect(sqlTemplate.toLowerCase()).toContain('(id, created_at, data)');
      expect(sqlTemplate.toLowerCase()).not.toContain('user_id');
      expect(sqlTemplate.toLowerCase()).toContain('returning *');

      expect(createCall.values).toContain('shared_documents');
      expect(createCall.values).toContain('shared-doc');
      expect(createCall.values).toContain(testDate);
      expect(createCall.values).toContain(testData);
      expect(createCall.values).not.toContain('creator-123');
    });

    it('should handle creation errors', async () => {
      const errorMock = createErrorThrowingMock('Creation failed');
      const errorAdapter = createTestAdapter('test_table', errorMock);

      const result = await errorAdapter.create({
        id: 'fail-id',
        createdAt: new Date(),
        data: { name: 'Test' },
      });

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      const error = result._unsafeUnwrapErr();
      expect(error).toBeInstanceOf(ErrorWithMetadata);
    });
  });

  describe('update()', () => {
    it('should return correct data and generate proper SQL with userId', async () => {
      const testDate = new Date('2024-01-01T12:00:00.000Z');
      const testData = { title: 'Updated Document' };

      const mockResult = [
        {
          id: 'update-doc',
          user_id: 'owner-123',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T12:00:00.000Z',
          data: testData,
        },
      ];

      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock(mockResult);

      const sqlCapturingAdapter = createTestAdapter(
        'documents',
        sqlCapturingMock,
      );

      const result = await sqlCapturingAdapter.update({
        where: {
          id: 'update-doc',
          userId: 'owner-123',
          updatedAt: testDate,
        },
        data: testData,
      });

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(data[0].id).toBe('update-doc');
      expect(data[0].user_id).toBe('owner-123');
      expect(data[0].updated_at).toBe('2024-01-01T12:00:00.000Z');
      expect(data[0].data).toEqual(testData);

      expect(sqlCalls.length).toBe(3);

      const allValues = sqlCalls.flatMap((call) => call.values);
      expect(allValues).toContain('documents');
      expect(allValues).toContain('update-doc');
      expect(allValues).toContain('owner-123');
      expect(allValues).toContain(testDate);
      expect(allValues).toContain(testData);

      const finalCall = sqlCalls[sqlCalls.length - 1];
      const finalSqlTemplate = finalCall.strings.join('PARAM');
      expect(finalSqlTemplate.toLowerCase()).toContain('returning *');

      const firstCall = sqlCalls[0];
      const firstSqlTemplate = firstCall.strings.join('PARAM');
      expect(firstSqlTemplate.toLowerCase()).toContain('update');
      expect(firstSqlTemplate.toLowerCase()).toContain('set data =');
      expect(firstSqlTemplate.toLowerCase()).toContain('updated_at =');
    });

    it('should return correct data and generate proper SQL without userId', async () => {
      const testDate = new Date('2024-01-01T12:00:00.000Z');
      const testData = { title: 'Updated Shared Document' };

      const mockResult = [
        {
          id: 'shared-update',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T12:00:00.000Z',
          data: testData,
        },
      ];

      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock(mockResult);

      const sqlCapturingAdapter = createTestAdapter(
        'shared_documents',
        sqlCapturingMock,
      );

      const result = await sqlCapturingAdapter.update({
        where: {
          id: 'shared-update',
          updatedAt: testDate,
        },
        data: testData,
      });

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(data[0].id).toBe('shared-update');
      expect(data[0].user_id).toBeUndefined();
      expect(data[0].data).toEqual(testData);

      expect(sqlCalls.length).toBe(2);

      const allValues = sqlCalls.flatMap((call) => call.values);
      expect(allValues).toContain('shared_documents');
      expect(allValues).toContain('shared-update');
      expect(allValues).toContain(testDate);
      expect(allValues).toContain(testData);
      expect(allValues).not.toContain('owner-123');
    });
  });

  describe('delete()', () => {
    it('should return correct data and generate proper SQL with userId', async () => {
      const mockResult = [
        {
          id: 'delete-doc',
          user_id: 'owner-456',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          data: { title: 'Deleted Document' },
        },
      ];

      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock(mockResult);

      const sqlCapturingAdapter = createTestAdapter(
        'documents',
        sqlCapturingMock,
      );

      const result = await sqlCapturingAdapter.delete({
        where: {
          id: 'delete-doc',
          userId: 'owner-456',
        },
      });

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(data[0].id).toBe('delete-doc');
      expect(data[0].user_id).toBe('owner-456');

      expect(sqlCalls.length).toBe(3);

      const allValues = sqlCalls.flatMap((call) => call.values);
      expect(allValues).toContain('documents');
      expect(allValues).toContain('delete-doc');
      expect(allValues).toContain('owner-456');

      const finalCall = sqlCalls[sqlCalls.length - 1];
      const finalSqlTemplate = finalCall.strings.join('PARAM');
      expect(finalSqlTemplate.toLowerCase()).toContain('returning *');

      const firstCall = sqlCalls[0];
      const firstSqlTemplate = firstCall.strings.join('PARAM');
      expect(firstSqlTemplate.toLowerCase()).toContain('delete from');
    });

    it('should return correct data and generate proper SQL without userId', async () => {
      const mockResult = [
        {
          id: 'shared-delete',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          data: { title: 'Deleted Shared Document' },
        },
      ];

      const { sqlCapturingMock, sqlCalls } = createSqlCapturingMock(mockResult);

      const sqlCapturingAdapter = createTestAdapter(
        'shared_documents',
        sqlCapturingMock,
      );

      const result = await sqlCapturingAdapter.delete({
        where: { id: 'shared-delete' },
      });

      expect(result.isOk()).toBe(true);
      const data = result._unsafeUnwrap();
      expect(data[0].id).toBe('shared-delete');
      expect(data[0].user_id).toBeUndefined();

      expect(sqlCalls.length).toBe(2);

      const allValues = sqlCalls.flatMap((call) => call.values);
      expect(allValues).toContain('shared_documents');
      expect(allValues).toContain('shared-delete');
      expect(allValues).not.toContain('owner-456');

      const finalCall = sqlCalls[sqlCalls.length - 1];
      const finalSqlTemplate = finalCall.strings.join('PARAM');
      expect(finalSqlTemplate.toLowerCase()).toContain('returning *');
    });
  });

  describe('getClient()', () => {
    it('should return database client from factory', () => {
      const result = adapter.getClient();

      expect(result).toBeDefined();
      expect(typeof result.isOk).toBe('function');
      expect(typeof result.isErr).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should handle database factory initialization errors', () => {
      const failingFactory = getMockedDatabaseClientFactory();
      failingFactory.getDatabase.mockReturnValue(
        err(new ErrorWithMetadata('DB init failed', 'InternalServer', {})),
      );

      const adapter = createRelationalDatabaseAdapter({
        clientFactory: failingFactory,
        tableName: 'test_table',
        clientType: 'bun-sql',
      });

      // Error happens on first getClient() call (lazy initialization)
      const result = adapter.getClient();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('DB init failed');
      }
    });

    it('should consistently handle SQL errors across all operations', async () => {
      const errorMock = createErrorThrowingMock('SQL execution failed');
      const errorAdapter = createTestAdapter('test_table', errorMock);

      const operations = [
        () => errorAdapter.findUnique({ where: { id: 'test' } }),
        () => errorAdapter.findMany(),
        () =>
          errorAdapter.create({ id: 'test', createdAt: new Date(), data: {} }),
        () =>
          errorAdapter.update({
            where: { id: 'test', updatedAt: new Date() },
            data: {},
          }),
        () => errorAdapter.delete({ where: { id: 'test' } }),
      ];

      for (const operation of operations) {
        const result = await operation();
        expect(result.isErr()).toBe(true);
        expect(result.isOk()).toBe(false);

        const error = result._unsafeUnwrapErr();
        expect(error).toBeInstanceOf(ErrorWithMetadata);
        expect(error.message).toBe('SQL execution failed');
      }
    });
  });
});
