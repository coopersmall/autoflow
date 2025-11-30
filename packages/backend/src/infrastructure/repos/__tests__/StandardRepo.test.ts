import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { convertQueryResultsToData } from '@backend/infrastructure/repos/actions/convertQueryResultsToData';
import { getMockedRelationalDatabaseAdapter } from '@backend/infrastructure/repos/adapters/__mocks__/RelationalDatabaseAdapter.mock';
import { getMockedDatabaseClientFactory } from '@backend/infrastructure/repos/clients/__mocks__/DatabaseClientFactory.mock';
import { StandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import { newId } from '@core/domain/Id';
import { UserId } from '@core/domain/user/user';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';

const testItemIdSchema = zod.string().brand<'TestItemId'>();
type TestItemId = zod.infer<typeof testItemIdSchema>;
const TestItemId = newId<TestItemId>;

const testItemSchema = zod.object({
  id: testItemIdSchema,
  createdAt: zod.date(),
  updatedAt: zod.date(),
  name: zod.string(),
  schemaVersion: zod.literal(1),
  value: zod.number(),
});

type TestItem = zod.infer<typeof testItemSchema>;

function validator(data: unknown): Result<TestItem, ValidationError> {
  return validate(testItemSchema, data);
}

describe('StandardRepo', () => {
  const mockStandardAdapter = getMockedRelationalDatabaseAdapter();
  const mockCreateAdapter = () => mockStandardAdapter;
  const mockClientFactory = getMockedDatabaseClientFactory();

  const dependencies = {
    createRelationalDatabaseAdapter: mockCreateAdapter,
    convertQueryResultsToData,
    createDatabaseClientFactory: () => mockClientFactory,
  };

  const createTestRepo = () => {
    return new StandardRepo<TestItemId, TestItem>(
      'test_items',
      getMockedAppConfigurationService(),
      validator,
      dependencies,
    );
  };

  beforeEach(() => {
    mock.restore();
    // Reset all mock call counts and implementations
    mockStandardAdapter.findUnique.mockReset();
    mockStandardAdapter.findMany.mockReset();
    mockStandardAdapter.create.mockReset();
    mockStandardAdapter.update.mockReset();
    mockStandardAdapter.delete.mockReset();
  });

  describe('get()', () => {
    it('should successfully get and validate an item', async () => {
      const testId = TestItemId('test-id-1');
      const testUserId = UserId('user-1');
      const testData = { name: 'Test Item', value: 42, schemaVersion: 1 };
      const testDate = '2024-01-01T00:00:00.000Z';

      mockStandardAdapter.findUnique.mockResolvedValue(
        ok([
          {
            id: testId,
            user_id: testUserId,
            created_at: testDate,
            updated_at: testDate,
            data: testData,
          },
        ]),
      );

      const repo = createTestRepo();

      const result = await repo.get(testId, testUserId);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have the expected result structure
      expect(result._unsafeUnwrap()).toBeDefined();
      const item = result._unsafeUnwrap();
      expect(item.id).toBe(testId);
      expect(item.name).toBe(testData.name);
      expect(item.value).toBe(testData.value);
      expect(item.schemaVersion).toBe(1);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);
    });

    it('should return not found error when adapter returns empty array', async () => {
      mockStandardAdapter.findUnique.mockResolvedValue(ok([]));

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.get(TestItemId('test-id'), UserId('user-1'));

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      // Assert we have the expected error
      const error = result._unsafeUnwrapErr();
      expect(error.name).toBe('NotFoundError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should propagate validation errors', async () => {
      const testDate = '2024-01-01T00:00:00.000Z';
      const incompleteData = { name: 'Invalid' };

      mockStandardAdapter.findUnique.mockResolvedValue(
        ok([
          {
            id: 'id-1',
            user_id: 'user-1',
            created_at: testDate,
            updated_at: testDate,
            data: incompleteData,
          },
        ]),
      );

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.get(TestItemId('test-id'), UserId('user-1'));

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      // Assert we have the expected validation error
      const error = result._unsafeUnwrapErr();
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed');
    });

    it('should propagate database errors from adapter', async () => {
      mockStandardAdapter.findUnique.mockResolvedValue(
        err(new ErrorWithMetadata('Database error', 'InternalServer')),
      );

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.get(TestItemId('test-id'), UserId('user-1'));

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      // Assert we have the expected database error
      const error = result._unsafeUnwrapErr();
      expect(error.message).toBe('Database error');
      expect(error).toBeInstanceOf(ErrorWithMetadata);
    });

    it('should return validation error when data is not in expected format', async () => {
      mockStandardAdapter.findUnique.mockResolvedValue(
        err(
          new ValidationError(
            new zod.ZodError([
              {
                code: 'invalid_type',
                expected: 'array',
                received: 'string',
                path: [],
                message: 'Expected array, received string',
              },
            ]),
          ),
        ),
      );

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.get(TestItemId('test-id'), UserId('user-1'));

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      // Assert we have the expected validation error for wrong data format
      const error = result._unsafeUnwrapErr();
      expect(error.message).toBe('Validation failed');
      expect(error).toBeInstanceOf(ValidationError);
    });

    it('should return validation error when data item has wrong structure', async () => {
      mockStandardAdapter.findUnique.mockResolvedValue(
        err(
          new ValidationError(
            new zod.ZodError([
              {
                code: 'invalid_type',
                expected: 'object',
                received: 'string',
                path: [0],
                message: 'Expected object, received string',
              },
            ]),
          ),
        ),
      );

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.get(TestItemId('test-id'), UserId('user-1'));

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      // Assert we have the expected validation error for wrong item structure
      const error = result._unsafeUnwrapErr();
      expect(error.message).toBe('Validation failed');
      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  describe('all()', () => {
    it('should successfully get and validate multiple items', async () => {
      const testUserId = UserId('user-1');
      const testDate = '2024-01-01T00:00:00.000Z';

      mockStandardAdapter.findMany.mockResolvedValue(
        ok([
          {
            id: 'id-1',
            user_id: testUserId,
            created_at: testDate,
            updated_at: testDate,
            data: { name: 'Item 1', value: 1, schemaVersion: 1 },
          },
          {
            id: 'id-2',
            user_id: testUserId,
            created_at: testDate,
            updated_at: testDate,
            data: { name: 'Item 2', value: 2, schemaVersion: 1 },
          },
          {
            id: 'id-3',
            user_id: testUserId,
            created_at: testDate,
            updated_at: testDate,
            data: { name: 'Item 3', value: 3, schemaVersion: 1 },
          },
        ]),
      );

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.all(testUserId);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have the expected array of items
      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(3);
      expect(Array.isArray(items)).toBe(true);

      // Validate each item has correct structure and data
      expect(items[0].name).toBe('Item 1');
      expect(items[0].value).toBe(1);
      expect(items[0].schemaVersion).toBe(1);
      expect(items[0].createdAt).toBeInstanceOf(Date);
      expect(items[0].updatedAt).toBeInstanceOf(Date);

      expect(items[1].name).toBe('Item 2');
      expect(items[1].value).toBe(2);
      expect(items[1].schemaVersion).toBe(1);

      expect(items[2].name).toBe('Item 3');
      expect(items[2].value).toBe(3);
      expect(items[2].schemaVersion).toBe(1);
    });

    it('should return empty array when no items found', async () => {
      mockStandardAdapter.findMany.mockResolvedValue(ok([]));

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.all(UserId('user-1'));

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have an empty array when no items found
      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(0);
      expect(Array.isArray(items)).toBe(true);
    });

    it('should propagate validation error for invalid item', async () => {
      const testDate = '2024-01-01T00:00:00.000Z';

      mockStandardAdapter.findMany.mockResolvedValue(
        ok([
          {
            id: 'id-1',
            user_id: 'user-1',
            created_at: testDate,
            updated_at: testDate,
            data: { name: 'Valid', value: 1, schemaVersion: 1 },
          },
          {
            id: 'id-2',
            user_id: 'user-1',
            created_at: testDate,
            updated_at: testDate,
            data: { name: 'Invalid', value: -1 },
          },
        ]),
      );

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.all(UserId('user-1'));

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      // Assert we have the expected validation error for invalid item in array
      const error = result._unsafeUnwrapErr();
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed');
    });
  });

  describe('create()', () => {
    it('should successfully create and validate an item', async () => {
      const testId = TestItemId('new-id');
      const testUserId = UserId('user-1');
      const testData = {
        name: 'New Item',
        value: 99,
        schemaVersion: 1 as const,
      };
      const testDate = '2024-01-01T00:00:00.000Z';

      mockStandardAdapter.create.mockImplementation((args) => {
        expect(args.id).toBe(testId);
        expect(args.userId).toBe(testUserId);
        expect(args.data).toEqual(testData);
        expect(args.createdAt).toBeInstanceOf(Date);
        return Promise.resolve(
          ok([
            {
              id: testId,
              user_id: testUserId,
              created_at: testDate,
              updated_at: testDate,
              data: testData,
            },
          ]),
        );
      });

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.create(testId, testUserId, testData);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have the expected created item
      const item = result._unsafeUnwrap();
      expect(item.id).toBe(testId);
      expect(item.name).toBe(testData.name);
      expect(item.value).toBe(testData.value);
      expect(item.schemaVersion).toBe(1);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);

      // Verify the adapter was called with correct parameters
      expect(mockStandardAdapter.create).toHaveBeenCalledTimes(1);
      const createCall = mockStandardAdapter.create.mock.calls[0][0];
      expect(typeof createCall.id).toBe('string');
      expect(typeof createCall.userId).toBe('string');
      expect(typeof createCall.data).toBe('object');
      expect(createCall.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('update()', () => {
    it('should successfully update and validate an item', async () => {
      const testId = TestItemId('existing-id');
      const testUserId = UserId('user-1');
      const updateData = {
        name: 'Updated Item',
        value: 100,
        schemaVersion: 1 as const,
      };
      const testDate = '2024-01-01T00:00:00.000Z';

      mockStandardAdapter.update.mockImplementation((args) => {
        expect(args.where.id).toBe(testId);
        expect(args.where.userId).toBe(testUserId);
        expect(args.where.updatedAt).toBeInstanceOf(Date);
        expect(args.data).toEqual(updateData);
        return Promise.resolve(
          ok([
            {
              id: testId,
              user_id: testUserId,
              created_at: testDate,
              updated_at: testDate,
              data: updateData,
            },
          ]),
        );
      });

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.update(testId, testUserId, updateData);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have the expected updated item
      const item = result._unsafeUnwrap();
      expect(item.id).toBe(testId);
      expect(item.name).toBe(updateData.name);
      expect(item.value).toBe(updateData.value);
      expect(item.schemaVersion).toBe(1);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);

      // Verify the adapter was called with correct parameters
      expect(mockStandardAdapter.update).toHaveBeenCalledTimes(1);
      const updateCall = mockStandardAdapter.update.mock.calls[0][0];
      expect(typeof updateCall.where.id).toBe('string');
      expect(typeof updateCall.where.userId).toBe('string');
      expect(updateCall.where.updatedAt).toBeInstanceOf(Date);
      expect(typeof updateCall.data).toBe('object');
    });
  });

  describe('delete()', () => {
    it('should successfully delete and return an item', async () => {
      const testId = TestItemId('delete-id');
      const testUserId = UserId('user-1');
      const testDate = '2024-01-01T00:00:00.000Z';
      const testData = { name: 'Deleted Item', value: 42, schemaVersion: 1 };

      mockStandardAdapter.delete.mockImplementation((args) => {
        expect(args.where.id).toBe(testId);
        expect(args.where.userId).toBe(testUserId);
        return Promise.resolve(
          ok([
            {
              id: testId,
              user_id: testUserId,
              created_at: testDate,
              updated_at: testDate,
              data: testData,
            },
          ]),
        );
      });

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.delete(testId, testUserId);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have the expected deleted item
      const item = result._unsafeUnwrap();
      expect(item.id).toBe(testId);
      expect(item.name).toBe(testData.name);
      expect(item.value).toBe(testData.value);
      expect(item.schemaVersion).toBe(1);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);

      // Verify the adapter was called with correct parameters
      expect(mockStandardAdapter.delete).toHaveBeenCalledTimes(1);
      const deleteCall = mockStandardAdapter.delete.mock.calls[0][0];
      expect(typeof deleteCall.where.id).toBe('string');
      expect(typeof deleteCall.where.userId).toBe('string');
    });
  });

  describe('dataToItems conversion', () => {
    it('should correctly validate and convert Bun SQL object format to items', async () => {
      const testDate1 = '2024-01-01T00:00:00.000Z';
      const testDate2 = '2024-01-02T00:00:00.000Z';

      mockStandardAdapter.findMany.mockResolvedValue(
        ok([
          {
            id: 'id-1',
            user_id: 'user-1',
            created_at: testDate1,
            updated_at: testDate1,
            data: { name: 'Item 1', value: 10, schemaVersion: 1 },
          },
          {
            id: 'id-2',
            user_id: 'user-1',
            created_at: testDate2,
            updated_at: testDate2,
            data: { name: 'Item 2', value: 20, schemaVersion: 1 },
          },
        ]),
      );

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.all(UserId('user-1'));

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have the expected conversion from Bun SQL object format
      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(2);
      expect(Array.isArray(items)).toBe(true);

      // Validate first item conversion
      expect(items[0].id).toBe(TestItemId('id-1'));
      expect(items[0].createdAt).toEqual(new Date(testDate1));
      expect(items[0].updatedAt).toEqual(new Date(testDate1));
      expect(items[0].name).toBe('Item 1');
      expect(items[0].value).toBe(10);
      expect(items[0].schemaVersion).toBe(1);

      // Validate second item conversion
      expect(items[1].id).toBe(TestItemId('id-2'));
      expect(items[1].createdAt).toEqual(new Date(testDate2));
      expect(items[1].updatedAt).toEqual(new Date(testDate2));
      expect(items[1].name).toBe('Item 2');
      expect(items[1].value).toBe(20);
      expect(items[1].schemaVersion).toBe(1);
    });

    it('should spread rawData object properties into validated item', async () => {
      const testDate = '2024-01-01T00:00:00.000Z';
      const complexData = {
        name: 'Complex',
        value: 42,
        schemaVersion: 1,
        nested: { prop: 'value' },
        array: [1, 2, 3],
      };

      mockStandardAdapter.findMany.mockResolvedValue(
        ok([
          {
            id: 'id-1',
            user_id: 'user-1',
            created_at: testDate,
            updated_at: testDate,
            data: complexData,
          },
        ]),
      );

      const repo = new StandardRepo<TestItemId, TestItem>(
        'test_items',
        getMockedAppConfigurationService(),
        validator,
        dependencies,
      );

      const result = await repo.all(UserId('user-1'));

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert complex data object is properly spread into validated item
      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(1);

      const item = items[0];
      expect(item.name).toBe('Complex');
      expect(item.value).toBe(42);
      expect(item.schemaVersion).toBe(1);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);
      expect(item.id).toBe(TestItemId('id-1'));
    });
  });
});
