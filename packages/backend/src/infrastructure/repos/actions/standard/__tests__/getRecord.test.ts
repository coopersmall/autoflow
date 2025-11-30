import { beforeEach, describe, expect, it } from 'bun:test';
import { getRecord } from '@backend/infrastructure/repos/actions/standard/getRecord';
import { getMockedRelationalDatabaseAdapter } from '@backend/infrastructure/repos/adapters/__mocks__/RelationalDatabaseAdapter.mock';
import { createDatabaseError } from '@backend/infrastructure/repos/errors/DBError';
import { newId } from '@core/domain/Id';
import { UserId } from '@core/domain/user/user';
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

describe('standard/getRecord', () => {
  const mockAdapter = getMockedRelationalDatabaseAdapter();

  beforeEach(() => {
    mockAdapter.findUnique.mockReset();
  });

  it('should successfully get and validate a user-scoped record', async () => {
    const testId = TestItemId('test-1');
    const userId = UserId('user-1');
    const testData = {
      name: 'Test Item',
      value: 42,
      schemaVersion: 1 as const,
    };
    const testDate = '2024-01-01T00:00:00.000Z';

    mockAdapter.findUnique.mockResolvedValue(
      ok([
        {
          id: testId,
          created_at: testDate,
          updated_at: testDate,
          data: testData,
        },
      ]),
    );

    const result = await getRecord<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      { id: testId, userId },
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const item = result.value;
      expect(item.id).toBe(testId);
      expect(item.name).toBe(testData.name);
      expect(item.value).toBe(testData.value);
    }

    // Verify userId filtering is applied
    expect(mockAdapter.findUnique).toHaveBeenCalledWith({
      where: { id: testId, userId },
    });
  });

  it('should return not found error when record does not exist or userId does not match', async () => {
    const testId = TestItemId('nonexistent');
    const userId = UserId('user-1');

    mockAdapter.findUnique.mockResolvedValue(ok([]));

    const result = await getRecord<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      { id: testId, userId },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('NotFound');
    }
  });

  it('should propagate validation errors', async () => {
    const testId = TestItemId('test-1');
    const userId = UserId('user-1');
    const invalidData = {
      name: 'Test',
      value: 'not a number' as any,
      schemaVersion: 1 as const,
    };

    mockAdapter.findUnique.mockResolvedValue(
      ok([
        {
          id: testId,
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
          data: invalidData,
        },
      ]),
    );

    const result = await getRecord<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      { id: testId, userId },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('BadRequest');
    }
  });

  it('should propagate database errors from adapter', async () => {
    const testId = TestItemId('test-1');
    const userId = UserId('user-1');
    const dbError = createDatabaseError(
      new Error('Database connection failed'),
    );

    mockAdapter.findUnique.mockResolvedValue(err(dbError));

    const result = await getRecord<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      { id: testId, userId },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(dbError);
    }
  });
});
