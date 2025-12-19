import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { convertQueryResultsToData } from '@backend/infrastructure/repos/actions/convertQueryResultsToData';
import type { RawDatabaseQuery } from '@backend/infrastructure/repos/domain/RawDatabaseQuery';

import { validate } from '@core/validation/validate';
import zod from 'zod';

// Test schema and types
const testItemSchema = zod.object({
  id: zod.string(),
  createdAt: zod.date(),
  updatedAt: zod.date().optional(),
  name: zod.string(),
  value: zod.number(),
  schemaVersion: zod.literal(1),
});

function createTestValidator() {
  return (data: unknown) => validate(testItemSchema, data);
}

describe('convertQueryResultsToData', () => {
  beforeEach(() => {
    mock.restore();
  });

  describe('successful conversion', () => {
    it('should convert valid raw database query to validated items', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T12:00:00.000Z',
          user_id: 'user-1',
          data: {
            name: 'Test Item 1',
            value: 42,
            schemaVersion: 1,
          },
        },
        {
          id: 'item-2',
          created_at: '2024-01-02T00:00:00.000Z',
          updated_at: '2024-01-02T12:00:00.000Z',
          user_id: 'user-1',
          data: {
            name: 'Test Item 2',
            value: 100,
            schemaVersion: 1,
          },
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      const items = result._unsafeUnwrap();
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(2);

      // Validate first item
      expect(items[0].id).toBe('item-1');
      expect(items[0].createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(items[0].updatedAt).toEqual(new Date('2024-01-01T12:00:00.000Z'));
      expect(items[0].name).toBe('Test Item 1');
      expect(items[0].value).toBe(42);
      expect(items[0].schemaVersion).toBe(1);

      // Validate second item
      expect(items[1].id).toBe('item-2');
      expect(items[1].createdAt).toEqual(new Date('2024-01-02T00:00:00.000Z'));
      expect(items[1].updatedAt).toEqual(new Date('2024-01-02T12:00:00.000Z'));
      expect(items[1].name).toBe('Test Item 2');
      expect(items[1].value).toBe(100);
      expect(items[1].schemaVersion).toBe(1);
    });

    it('should handle items without updated_at field', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: '2024-01-01T00:00:00.000Z',
          user_id: 'user-1',
          data: {
            name: 'Test Item',
            value: 42,
            schemaVersion: 1,
          },
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('item-1');
      expect(items[0].createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(items[0].updatedAt).toBeUndefined();
      expect(items[0].name).toBe('Test Item');
      expect(items[0].value).toBe(42);
    });

    it('should spread complex data objects correctly', () => {
      const complexData = {
        name: 'Complex Item',
        value: 42,
        schemaVersion: 1,
        nested: { prop: 'value' },
        array: [1, 2, 3],
        boolean: true,
      };

      const rawData: RawDatabaseQuery = [
        {
          id: 'complex-1',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T12:00:00.000Z',
          user_id: 'user-1',
          data: complexData,
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Complex Item');
      expect(items[0].value).toBe(42);
      expect(items[0].schemaVersion).toBe(1);
      // Note: nested, array, boolean are spread but not validated by our schema
    });
  });

  describe('empty input handling', () => {
    it('should return empty array for empty input', () => {
      const rawData: RawDatabaseQuery = [];
      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      const items = result._unsafeUnwrap();
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(0);
    });
  });

  describe('date conversion behavior', () => {
    it('should handle invalid created_at date strings (creates Invalid Date)', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: 'invalid-date-string',
          user_id: 'user-1',
          data: {
            name: 'Test Item',
            value: 42,
            schemaVersion: 1,
          },
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      // The Date constructor doesn't throw for invalid strings, it creates Invalid Date
      // This will likely fail validation when the validator tries to validate the Invalid Date
      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      const error = result._unsafeUnwrapErr();
      expect(error.message).toBe('Validation failed');
    });

    it('should handle invalid updated_at date strings (creates Invalid Date)', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: 'invalid-date-string',
          user_id: 'user-1',
          data: {
            name: 'Test Item',
            value: 42,
            schemaVersion: 1,
          },
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      const error = result._unsafeUnwrapErr();
      expect(error.message).toBe('Validation failed');
    });

    it('should handle empty string created_at (creates Invalid Date)', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: '',
          user_id: 'user-1',
          data: {
            name: 'Test Item',
            value: 42,
            schemaVersion: 1,
          },
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      const error = result._unsafeUnwrapErr();
      expect(error.message).toBe('Validation failed');
    });
  });

  describe('validation error propagation', () => {
    it('should propagate validation errors from validator function', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T12:00:00.000Z',
          user_id: 'user-1',
          data: {
            name: 'Test Item',
            value: 'invalid-number', // Should be number, not string
            schemaVersion: 1,
          },
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      const error = result._unsafeUnwrapErr();
      expect(error.message).toBe('Validation failed');
    });

    it('should fail on first validation error in array of items', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: '2024-01-01T00:00:00.000Z',
          user_id: 'user-1',
          data: {
            name: 'Valid Item',
            value: 42,
            schemaVersion: 1,
          },
        },
        {
          id: 'item-2',
          created_at: '2024-01-02T00:00:00.000Z',
          user_id: 'user-1',
          data: {
            name: 'Invalid Item',
            value: 'not-a-number', // Invalid value
            schemaVersion: 1,
          },
        },
        {
          id: 'item-3',
          created_at: '2024-01-03T00:00:00.000Z',
          user_id: 'user-1',
          data: {
            name: 'Another Valid Item',
            value: 99,
            schemaVersion: 1,
          },
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      const error = result._unsafeUnwrapErr();
      expect(error.message).toBe('Validation failed');
    });

    it('should handle missing required fields in data', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: '2024-01-01T00:00:00.000Z',
          user_id: 'user-1',
          data: {
            name: 'Incomplete Item',
            // Missing value and schemaVersion
          },
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      const error = result._unsafeUnwrapErr();
      expect(error.message).toBe('Validation failed');
    });
  });

  describe('edge cases and data types', () => {
    it('should handle different date string formats correctly', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: '2024-01-01T00:00:00Z', // Without milliseconds
          updated_at: '2024-01-01T12:30:45.123Z', // With milliseconds
          user_id: 'user-1',
          data: {
            name: 'Date Format Test',
            value: 42,
            schemaVersion: 1,
          },
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(1);
      expect(items[0].createdAt).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(items[0].updatedAt).toEqual(new Date('2024-01-01T12:30:45.123Z'));
    });

    it('should preserve order of items in the array', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: '2024-01-01T00:00:00.000Z',
          user_id: 'user-1',
          data: { name: 'First', value: 1, schemaVersion: 1 },
        },
        {
          id: 'item-2',
          created_at: '2024-01-02T00:00:00.000Z',
          user_id: 'user-1',
          data: { name: 'Second', value: 2, schemaVersion: 1 },
        },
        {
          id: 'item-3',
          created_at: '2024-01-03T00:00:00.000Z',
          user_id: 'user-1',
          data: { name: 'Third', value: 3, schemaVersion: 1 },
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(3);
      expect(items[0].name).toBe('First');
      expect(items[1].name).toBe('Second');
      expect(items[2].name).toBe('Third');
      expect(items[0].value).toBe(1);
      expect(items[1].value).toBe(2);
      expect(items[2].value).toBe(3);
    });
  });

  describe('additional edge cases', () => {
    it('should handle very large arrays efficiently', () => {
      const rawData: RawDatabaseQuery = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T12:00:00.000Z',
        user_id: 'user-1',
        data: {
          name: `Item ${i}`,
          value: i,
          schemaVersion: 1,
        },
      }));

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(100);
      expect(items[0].name).toBe('Item 0');
      expect(items[99].name).toBe('Item 99');
      expect(items[50].value).toBe(50);
    });

    it('should handle mixed valid and invalid dates in array', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: '2024-01-01T00:00:00.000Z', // Valid
          user_id: 'user-1',
          data: { name: 'Valid Item', value: 1, schemaVersion: 1 },
        },
        {
          id: 'item-2',
          created_at: 'invalid-date', // Invalid - will create Invalid Date
          user_id: 'user-1',
          data: { name: 'Invalid Item', value: 2, schemaVersion: 1 },
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      // Should fail on the second item due to Invalid Date
      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      const error = result._unsafeUnwrapErr();
      expect(error.code).toBe('BadRequest');
    });

    it('should handle data with deeply nested objects', () => {
      const complexData = {
        name: 'Complex Item',
        value: 42,
        schemaVersion: 1,
        metadata: {
          tags: ['tag1', 'tag2'],
          config: {
            enabled: true,
            settings: {
              level: 5,
              mode: 'advanced',
            },
          },
        },
      };

      const rawData: RawDatabaseQuery = [
        {
          id: 'complex-1',
          created_at: '2024-01-01T00:00:00.000Z',
          user_id: 'user-1',
          data: complexData,
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Complex Item');
      expect(items[0].value).toBe(42);
      // Note: metadata won't be in the validated result since it's not in our schema
    });
  });

  describe('data field combinations', () => {
    it('should handle items where data overrides standard fields', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T12:00:00.000Z',
          user_id: 'user-1',
          data: {
            id: 'data-id-override', // This WILL override the id field due to spread order
            name: 'Test Item',
            value: 42,
            schemaVersion: 1,
          },
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);

      const items = result._unsafeUnwrap();
      expect(items).toHaveLength(1);
      // The data.id actually overrides the database row id due to spread order: {...d.data}
      expect(items[0].id).toBe('data-id-override');
      expect(items[0].name).toBe('Test Item');
      expect(items[0].value).toBe(42);
      expect(items[0].createdAt).toEqual(new Date('2024-01-01T00:00:00.000Z'));
      expect(items[0].updatedAt).toEqual(new Date('2024-01-01T12:00:00.000Z'));
    });

    it('should handle empty data object', () => {
      const rawData: RawDatabaseQuery = [
        {
          id: 'item-1',
          created_at: '2024-01-01T00:00:00.000Z',
          user_id: 'user-1',
          data: {},
        },
      ];

      const validator = createTestValidator();
      const result = convertQueryResultsToData(rawData, validator);

      expect(result.isErr()).toBe(true);
      expect(result.isOk()).toBe(false);

      const error = result._unsafeUnwrapErr();
      expect(error.message).toBe('Validation failed');
    });
  });
});
