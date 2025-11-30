import { beforeEach, describe, expect, it } from 'bun:test';
import { getAllRecords } from '@backend/infrastructure/repos/actions/shared/getAllRecords';
import { getMockedRelationalDatabaseAdapter } from '@backend/infrastructure/repos/adapters/__mocks__/RelationalDatabaseAdapter.mock';
import { createDatabaseError } from '@backend/infrastructure/repos/errors/DBError';
import { newId } from '@core/domain/Id';
import type { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';

const testItemIdSchema = zod.string().brand<'TestItemId'>();
type TestItemId = zod.infer<typeof testItemIdSchema>;
const TestItemId = newId<TestItemId>;

const testItemSchema = zod.object({
  id: testItemIdSchema,
  createdAt: zod.coerce.date(),
  updatedAt: zod.coerce.date(),
  name: zod.string(),
  value: zod.number(),
  schemaVersion: zod.literal(1),
});

type TestItem = zod.infer<typeof testItemSchema>;

describe('shared/getAllRecords', () => {
  const mockAdapter = getMockedRelationalDatabaseAdapter();

  beforeEach(() => {
    mockAdapter.findMany.mockReset();
  });

  it('should successfully get and validate multiple records', async () => {
    const testDate = '2024-01-01T00:00:00.000Z';
    const mockData = [
      {
        id: TestItemId('test-1'),
        created_at: testDate,
        updated_at: testDate,
        data: { name: 'Item 1', value: 10, schemaVersion: 1 },
      },
      {
        id: TestItemId('test-2'),
        created_at: testDate,
        updated_at: testDate,
        data: { name: 'Item 2', value: 20, schemaVersion: 1 },
      },
    ];

    mockAdapter.findMany.mockResolvedValue(ok(mockData));

    const result = await getAllRecords<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      {},
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toHaveLength(2);
      expect(result.value[0].name).toBe('Item 1');
      expect(result.value[1].name).toBe('Item 2');
    }

    expect(mockAdapter.findMany).toHaveBeenCalledWith({
      where: {},
      limit: undefined,
    });
  });

  it('should apply limit when provided', async () => {
    const testDate = '2024-01-01T00:00:00.000Z';
    const mockData = [
      {
        id: TestItemId('test-1'),
        created_at: testDate,
        updated_at: testDate,
        data: { name: 'Item 1', value: 10, schemaVersion: 1 },
      },
    ];

    mockAdapter.findMany.mockResolvedValue(ok(mockData));

    const result = await getAllRecords<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      { limit: 5 },
    );

    expect(result.isOk()).toBe(true);
    expect(mockAdapter.findMany).toHaveBeenCalledWith({ where: {}, limit: 5 });
  });

  it('should return empty array when no records found', async () => {
    mockAdapter.findMany.mockResolvedValue(ok([]));

    const result = await getAllRecords<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      {},
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual([]);
    }
  });

  it('should propagate validation error for invalid item', async () => {
    const testDate = '2024-01-01T00:00:00.000Z';
    const mockData = [
      {
        id: TestItemId('test-1'),
        created_at: testDate,
        updated_at: testDate,
        data: { name: 'Item 1', value: 'invalid', schemaVersion: 1 }, // Invalid: value should be number
      },
    ];

    mockAdapter.findMany.mockResolvedValue(ok(mockData));

    const result = await getAllRecords<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      {},
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('BadRequest');
    }
  });

  it('should propagate database errors from adapter', async () => {
    const dbError = createDatabaseError(
      new Error('Database connection failed'),
    );

    mockAdapter.findMany.mockResolvedValue(err(dbError));

    const result = await getAllRecords<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      {},
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(dbError);
    }
  });
});
