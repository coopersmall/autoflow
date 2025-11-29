import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { convertQueryResultsToData } from '@backend/repos/actions/convertQueryResultsToData';
import { getMockedRelationalDatabaseAdapter } from '@backend/repos/adapters/__mocks__/RelationalDatabaseAdapter.mock';
import { getMockedDatabaseClientFactory } from '@backend/repos/clients/__mocks__/DatabaseClientFactory.mock';
import { SharedRepo } from '@backend/repos/SharedRepo';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { newId } from '@core/domain/Id';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';

const testSharedItemIdSchema = zod.string().brand<'TestSharedItemId'>();
type TestSharedItemId = zod.infer<typeof testSharedItemIdSchema>;
const TestSharedItemId = newId<TestSharedItemId>;

const testSharedItemSchema = zod.object({
  id: testSharedItemIdSchema,
  createdAt: zod.date(),
  updatedAt: zod.date(),
  name: zod.string(),
  schemaVersion: zod.literal(1),
  value: zod.number(),
  category: zod.string().optional(),
});

type TestSharedItem = zod.infer<typeof testSharedItemSchema>;

function validator(data: unknown): Result<TestSharedItem, ValidationError> {
  return validate(testSharedItemSchema, data);
}

describe('SharedRepo', () => {
  const mockSharedAdapter = getMockedRelationalDatabaseAdapter();
  const mockCreateAdapter = () => mockSharedAdapter;
  const mockClientFactory = getMockedDatabaseClientFactory();

  const dependencies = {
    createRelationalDatabaseAdapter: mockCreateAdapter,
    convertQueryResultsToData,
    createDatabaseClientFactory: () => mockClientFactory,
  };

  const createTestRepo = () => {
    return new SharedRepo<TestSharedItemId, TestSharedItem>(
      getMockedAppConfigurationService(),
      'shared_items',
      validator,
      dependencies,
    );
  };

  beforeEach(() => {
    mock.restore();
    // Reset all mock call counts and implementations
    mockSharedAdapter.findUnique.mockReset();
    mockSharedAdapter.findMany.mockReset();
    mockSharedAdapter.create.mockReset();
    mockSharedAdapter.update.mockReset();
    mockSharedAdapter.delete.mockReset();
  });

  describe('get()', () => {
    it('should successfully get and validate a shared item', async () => {
      const testId = TestSharedItemId('shared-item-1');
      const testData = {
        name: 'Shared Test Item',
        value: 42,
        schemaVersion: 1,
        category: 'template',
      };
      const testDate = '2024-01-01T00:00:00.000Z';

      mockSharedAdapter.findUnique.mockResolvedValue(
        ok([
          {
            id: testId,
            created_at: testDate,
            updated_at: testDate,
            data: testData,
          },
        ]),
      );

      const repo = createTestRepo();

      const result = await repo.get(testId);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have the expected result structure
      expect(result._unsafeUnwrap()).toBeDefined();
      const item = result._unsafeUnwrap();
      expect(item.id).toBe(testId);
      expect(item.name).toBe(testData.name);
      expect(item.value).toBe(testData.value);
      expect(item.category).toBe(testData.category);
      expect(item.schemaVersion).toBe(1);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);

      // Verify adapter was called without userId (shared data)
      expect(mockSharedAdapter.findUnique).toHaveBeenCalledWith({
        where: { id: testId },
      });
    });

    it('should return not found error when adapter returns empty array', async () => {
      mockSharedAdapter.findUnique.mockResolvedValue(ok([]));

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.get(TestSharedItemId('non-existent-id'));

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      // Assert we have the expected error
      const error = result._unsafeUnwrapErr();
      expect(error.name).toBe('NotFoundError');
      expect(error).toBeInstanceOf(Error);
    });

    it('should propagate validation errors', async () => {
      const testDate = '2024-01-01T00:00:00.000Z';
      const incompleteData = { name: 'Invalid' }; // Missing required fields

      mockSharedAdapter.findUnique.mockResolvedValue(
        ok([
          {
            id: 'shared-id-1',
            created_at: testDate,
            updated_at: testDate,
            data: incompleteData,
          },
        ]),
      );

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.get(TestSharedItemId('shared-id'));

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      // Assert we have the expected validation error
      const error = result._unsafeUnwrapErr();
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed');
    });

    it('should propagate database errors from adapter', async () => {
      mockSharedAdapter.findUnique.mockResolvedValue(
        err(new ErrorWithMetadata('Database error', 'InternalServer')),
      );

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.get(TestSharedItemId('shared-id'));

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      // Assert we have the expected database error
      const error = result._unsafeUnwrapErr();
      expect(error.message).toBe('Database error');
      expect(error).toBeInstanceOf(ErrorWithMetadata);
    });
  });

  describe('all()', () => {
    it('should successfully get and validate multiple shared items', async () => {
      const testDate = '2024-01-01T00:00:00.000Z';

      mockSharedAdapter.findMany.mockResolvedValue(
        ok([
          {
            id: 'shared-1',
            created_at: testDate,
            updated_at: testDate,
            data: {
              name: 'Template 1',
              value: 1,
              schemaVersion: 1,
              category: 'template',
            },
          },
          {
            id: 'shared-2',
            created_at: testDate,
            updated_at: testDate,
            data: {
              name: 'Template 2',
              value: 2,
              schemaVersion: 1,
              category: 'config',
            },
          },
          {
            id: 'shared-3',
            created_at: testDate,
            updated_at: testDate,
            data: { name: 'Template 3', value: 3, schemaVersion: 1 },
          },
        ]),
      );

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.all();

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have the expected array of items
      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(3);
      expect(Array.isArray(items)).toBe(true);

      // Validate each item has correct structure and data
      expect(items[0].name).toBe('Template 1');
      expect(items[0].value).toBe(1);
      expect(items[0].category).toBe('template');
      expect(items[0].schemaVersion).toBe(1);
      expect(items[0].createdAt).toBeInstanceOf(Date);
      expect(items[0].updatedAt).toBeInstanceOf(Date);

      expect(items[1].name).toBe('Template 2');
      expect(items[1].value).toBe(2);
      expect(items[1].category).toBe('config');
      expect(items[1].schemaVersion).toBe(1);

      expect(items[2].name).toBe('Template 3');
      expect(items[2].value).toBe(3);
      expect(items[2].category).toBeUndefined(); // Optional field
      expect(items[2].schemaVersion).toBe(1);

      // Verify adapter was called with empty where clause (no user filtering)
      expect(mockSharedAdapter.findMany).toHaveBeenCalledWith({
        where: {},
        limit: undefined,
      });
    });

    it('should successfully apply limit to shared items', async () => {
      const testDate = '2024-01-01T00:00:00.000Z';

      mockSharedAdapter.findMany.mockResolvedValue(
        ok([
          {
            id: 'shared-1',
            created_at: testDate,
            updated_at: testDate,
            data: { name: 'Template 1', value: 1, schemaVersion: 1 },
          },
          {
            id: 'shared-2',
            created_at: testDate,
            updated_at: testDate,
            data: { name: 'Template 2', value: 2, schemaVersion: 1 },
          },
        ]),
      );

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.all({ limit: 2 });

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert limit was passed to adapter
      expect(mockSharedAdapter.findMany).toHaveBeenCalledWith({
        where: {},
        limit: 2,
      });

      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(2);
      expect(items[0].name).toBe('Template 1');
      expect(items[1].name).toBe('Template 2');
    });

    it('should return empty array when no shared items found', async () => {
      mockSharedAdapter.findMany.mockResolvedValue(ok([]));

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.all();

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have an empty array when no items found
      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(0);
      expect(Array.isArray(items)).toBe(true);
    });

    it('should propagate validation error for invalid item', async () => {
      const testDate = '2024-01-01T00:00:00.000Z';

      mockSharedAdapter.findMany.mockResolvedValue(
        ok([
          {
            id: 'shared-1',
            created_at: testDate,
            updated_at: testDate,
            data: { name: 'Valid', value: 1, schemaVersion: 1 },
          },
          {
            id: 'shared-2',
            created_at: testDate,
            updated_at: testDate,
            data: { name: 'Invalid', value: 'not-a-number' }, // Invalid value type
          },
        ]),
      );

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.all();

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      // Assert we have the expected validation error for invalid item in array
      const error = result._unsafeUnwrapErr();
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Validation failed');
    });
  });

  describe('create()', () => {
    it('should successfully create and validate a shared item', async () => {
      const testId = TestSharedItemId('new-shared-id');
      const testData = {
        name: 'New Shared Item',
        value: 99,
        schemaVersion: 1 as const,
        category: 'template',
      };
      const testDate = '2024-01-01T00:00:00.000Z';

      mockSharedAdapter.create.mockImplementation((args) => {
        expect(args.id).toBe(testId);
        expect(args.userId).toBeUndefined(); // No userId for shared items
        expect(args.data).toEqual(testData);
        expect(args.createdAt).toBeInstanceOf(Date);
        return Promise.resolve(
          ok([
            {
              id: testId,
              created_at: testDate,
              updated_at: testDate,
              data: testData,
            },
          ]),
        );
      });

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.create(testId, testData);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have the expected created item
      const item = result._unsafeUnwrap();
      expect(item.id).toBe(testId);
      expect(item.name).toBe(testData.name);
      expect(item.value).toBe(testData.value);
      expect(item.category).toBe(testData.category);
      expect(item.schemaVersion).toBe(1);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);

      // Verify the adapter was called with correct parameters
      expect(mockSharedAdapter.create).toHaveBeenCalledTimes(1);
      const createCall = mockSharedAdapter.create.mock.calls[0][0];
      expect(typeof createCall.id).toBe('string');
      expect(createCall.userId).toBeUndefined(); // SharedRepo doesn't use userId
      expect(typeof createCall.data).toBe('object');
      expect(createCall.createdAt).toBeInstanceOf(Date);
    });

    it('should create shared item without optional fields', async () => {
      const testId = TestSharedItemId('minimal-shared-id');
      const testData = {
        name: 'Minimal Shared Item',
        value: 10,
        schemaVersion: 1 as const,
        // category is optional
      };
      const testDate = '2024-01-01T00:00:00.000Z';

      mockSharedAdapter.create.mockResolvedValue(
        ok([
          {
            id: testId,
            created_at: testDate,
            updated_at: testDate,
            data: testData,
          },
        ]),
      );

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.create(testId, testData);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      const item = result._unsafeUnwrap();
      expect(item.category).toBeUndefined();
      expect(item.name).toBe(testData.name);
    });
  });

  describe('update()', () => {
    it('should successfully update and validate a shared item', async () => {
      const testId = TestSharedItemId('update-shared-id');
      const updateData = {
        name: 'Updated Shared Item',
        value: 100,
        category: 'updated-template',
      };
      const testDate = '2024-01-01T00:00:00.000Z';

      mockSharedAdapter.update.mockImplementation((args) => {
        expect(args.where.id).toBe(testId);
        expect(args.where.userId).toBeUndefined(); // No userId for shared items
        expect(args.where.updatedAt).toBeInstanceOf(Date);
        expect(args.data).toEqual(updateData);
        return Promise.resolve(
          ok([
            {
              id: testId,
              created_at: testDate,
              updated_at: testDate,
              data: { ...updateData, schemaVersion: 1 },
            },
          ]),
        );
      });

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.update(testId, updateData);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have the expected updated item
      const item = result._unsafeUnwrap();
      expect(item.id).toBe(testId);
      expect(item.name).toBe(updateData.name);
      expect(item.value).toBe(updateData.value);
      expect(item.category).toBe(updateData.category);
      expect(item.schemaVersion).toBe(1);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);

      // Verify the adapter was called with correct parameters
      expect(mockSharedAdapter.update).toHaveBeenCalledTimes(1);
      const updateCall = mockSharedAdapter.update.mock.calls[0][0];
      expect(typeof updateCall.where.id).toBe('string');
      expect(updateCall.where.userId).toBeUndefined(); // No userId for shared items
      expect(updateCall.where.updatedAt).toBeInstanceOf(Date);
      expect(typeof updateCall.data).toBe('object');
    });
  });

  describe('delete()', () => {
    it('should successfully delete and return a shared item', async () => {
      const testId = TestSharedItemId('delete-shared-id');
      const testDate = '2024-01-01T00:00:00.000Z';
      const testData = {
        name: 'Deleted Shared Item',
        value: 42,
        schemaVersion: 1,
        category: 'to-delete',
      };

      mockSharedAdapter.delete.mockImplementation((args) => {
        expect(args.where.id).toBe(testId);
        expect(args.where.userId).toBeUndefined(); // No userId for shared items
        return Promise.resolve(
          ok([
            {
              id: testId,
              created_at: testDate,
              updated_at: testDate,
              data: testData,
            },
          ]),
        );
      });

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.delete(testId);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have the expected deleted item
      const item = result._unsafeUnwrap();
      expect(item.id).toBe(testId);
      expect(item.name).toBe(testData.name);
      expect(item.value).toBe(testData.value);
      expect(item.category).toBe(testData.category);
      expect(item.schemaVersion).toBe(1);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);

      // Verify the adapter was called with correct parameters
      expect(mockSharedAdapter.delete).toHaveBeenCalledTimes(1);
      const deleteCall = mockSharedAdapter.delete.mock.calls[0][0];
      expect(typeof deleteCall.where.id).toBe('string');
      expect(deleteCall.where.userId).toBeUndefined(); // No userId for shared items
    });
  });

  describe('data conversion and shared-specific features', () => {
    it('should correctly validate and convert shared data objects', async () => {
      const testDate1 = '2024-01-01T00:00:00.000Z';
      const testDate2 = '2024-01-02T00:00:00.000Z';

      mockSharedAdapter.findMany.mockResolvedValue(
        ok([
          {
            id: 'shared-1',
            created_at: testDate1,
            updated_at: testDate1,
            data: {
              name: 'Shared Item 1',
              value: 10,
              schemaVersion: 1,
              category: 'template',
            },
          },
          {
            id: 'shared-2',
            created_at: testDate2,
            updated_at: testDate2,
            data: { name: 'Shared Item 2', value: 20, schemaVersion: 1 },
          },
        ]),
      );

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.all();

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert we have the expected conversion from shared data format
      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(2);
      expect(Array.isArray(items)).toBe(true);

      // Validate first item conversion
      expect(items[0].id).toBe(TestSharedItemId('shared-1'));
      expect(items[0].createdAt).toEqual(new Date(testDate1));
      expect(items[0].updatedAt).toEqual(new Date(testDate1));
      expect(items[0].name).toBe('Shared Item 1');
      expect(items[0].value).toBe(10);
      expect(items[0].category).toBe('template');
      expect(items[0].schemaVersion).toBe(1);

      // Validate second item conversion (no category)
      expect(items[1].id).toBe(TestSharedItemId('shared-2'));
      expect(items[1].createdAt).toEqual(new Date(testDate2));
      expect(items[1].updatedAt).toEqual(new Date(testDate2));
      expect(items[1].name).toBe('Shared Item 2');
      expect(items[1].value).toBe(20);
      expect(items[1].category).toBeUndefined();
      expect(items[1].schemaVersion).toBe(1);
    });

    it('should handle complex shared data with nested objects', async () => {
      const testDate = '2024-01-01T00:00:00.000Z';
      const complexData = {
        name: 'Complex Shared Item',
        value: 42,
        schemaVersion: 1,
        category: 'template',
        // These won't be validated by schema but will be preserved
        nested: { prop: 'value' },
        array: [1, 2, 3],
      };

      mockSharedAdapter.findMany.mockResolvedValue(
        ok([
          {
            id: 'complex-shared-1',
            created_at: testDate,
            updated_at: testDate,
            data: complexData,
          },
        ]),
      );

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      const result = await repo.all();

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      // Assert complex shared data object is properly validated
      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(1);

      const item = items[0];
      expect(item.name).toBe('Complex Shared Item');
      expect(item.value).toBe(42);
      expect(item.category).toBe('template');
      expect(item.schemaVersion).toBe(1);
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);
      expect(item.id).toBe(TestSharedItemId('complex-shared-1'));
    });

    it('should verify no user-specific filtering is applied', async () => {
      mockSharedAdapter.findMany.mockResolvedValue(ok([]));

      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      await repo.all({ limit: 10 });

      // Verify that findMany is called with empty where clause (no user filtering)
      expect(mockSharedAdapter.findMany).toHaveBeenCalledWith({
        where: {},
        limit: 10,
      });

      // Ensure no userId parameter was passed anywhere
      const call = mockSharedAdapter.findMany.mock.calls[0][0];
      expect(call?.where?.userId).toBeUndefined();
    });
  });

  describe('getClient()', () => {
    it('should return database connection', () => {
      const repo = new SharedRepo<TestSharedItemId, TestSharedItem>(
        getMockedAppConfigurationService(),
        'shared_items',
        validator,
        dependencies,
      );

      repo.getClient();

      // This should delegate to the adapter's getClient() method
      // The specific implementation depends on the mock setup
      expect(mockSharedAdapter.getClient).toHaveBeenCalledTimes(1);
    });
  });
});
