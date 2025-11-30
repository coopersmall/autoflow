import { beforeEach, describe, expect, it } from 'bun:test';
import { updateRecord } from '@backend/infrastructure/repos/actions/shared/updateRecord';
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

describe('shared/updateRecord', () => {
  const mockAdapter = getMockedRelationalDatabaseAdapter();

  beforeEach(() => {
    mockAdapter.update.mockReset();
  });

  it('should successfully update and validate a record', async () => {
    const testId = TestItemId('test-1');
    const updatedData = { name: 'Updated Item', value: 100, schemaVersion: 1 };
    const testDate = '2024-01-01T00:00:00.000Z';

    mockAdapter.update.mockResolvedValue(
      ok([
        {
          id: testId,
          created_at: testDate,
          updated_at: testDate,
          data: updatedData,
        },
      ]),
    );

    const result = await updateRecord<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      { id: testId, data: { name: 'Updated Item' } },
    );

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const item = result.value;
      expect(item.id).toBe(testId);
      expect(item.name).toBe(updatedData.name);
      expect(item.value).toBe(updatedData.value);
    }

    expect(mockAdapter.update).toHaveBeenCalledWith({
      where: { id: testId, updatedAt: expect.any(Date) },
      data: { name: 'Updated Item' },
    });
  });

  it('should return not found error when record does not exist', async () => {
    const testId = TestItemId('nonexistent');

    mockAdapter.update.mockResolvedValue(ok([]));

    const result = await updateRecord<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      { id: testId, data: { name: 'Updated' } },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('NotFound');
    }
  });

  it('should propagate validation errors', async () => {
    const testId = TestItemId('test-1');
    const invalidData = {
      name: 'Test',
      value: 'not a number',
      schemaVersion: 1,
    };
    const testDate = '2024-01-01T00:00:00.000Z';

    mockAdapter.update.mockResolvedValue(
      ok([
        {
          id: testId,
          created_at: testDate,
          updated_at: testDate,
          data: invalidData,
        },
      ]),
    );

    const result = await updateRecord<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      { id: testId, data: { value: 'not a number' as any } },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('BadRequest');
    }
  });

  it('should propagate database errors from adapter', async () => {
    const testId = TestItemId('test-1');
    const dbError = createDatabaseError(
      new Error('Database connection failed'),
    );

    mockAdapter.update.mockResolvedValue(err(dbError));

    const result = await updateRecord<TestItemId, TestItem>(
      {
        adapter: mockAdapter,
        validator: (data) =>
          validate(testItemSchema, data) as Result<TestItem, ValidationError>,
      },
      { id: testId, data: { name: 'Updated' } },
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(dbError);
    }
  });
});
