import { describe, expect, it } from 'bun:test';
import {
  convertCacheData,
  deserializeCacheData,
  serializeCacheData,
} from '@backend/cache/actions/convertCacheData';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Validator } from '@core/validation/validate';
import { err, ok } from 'neverthrow';

describe('serializeCacheData', () => {
  it('should serialize simple object to JSON string', () => {
    const value = { name: 'John', age: 30 };

    const result = serializeCacheData(value);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('{"name":"John","age":30}');
    }
  });

  it('should serialize array to JSON string', () => {
    const value = [1, 2, 3];

    const result = serializeCacheData(value);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('[1,2,3]');
    }
  });

  it('should serialize nested object to JSON string', () => {
    const value = { user: { id: '123', name: 'Alice' }, active: true };

    const result = serializeCacheData(value);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(
        '{"user":{"id":"123","name":"Alice"},"active":true}',
      );
    }
  });

  it('should serialize null to JSON string', () => {
    const result = serializeCacheData(null);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('null');
    }
  });

  it('should serialize string to JSON string', () => {
    const result = serializeCacheData('hello world');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe('"hello world"');
    }
  });

  it('should handle circular reference with error', () => {
    const circular: Record<string, unknown> = { name: 'test' };
    circular.self = circular;

    const result = serializeCacheData(circular);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ErrorWithMetadata);
      expect(result.error.message).toBe('Cache serialization error');
      expect(result.error.code).toBe('InternalServer');
    }
  });

  it('should include metadata in error when provided', () => {
    const circular: Record<string, unknown> = { name: 'test' };
    circular.self = circular;
    const metadata = { key: 'test-key', id: 'test-id' };

    const result = serializeCacheData(circular, metadata);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.metadata).toMatchObject(metadata);
    }
  });
});

describe('deserializeCacheData', () => {
  const validatorMock = <T>(expectedValue: T): Validator<T> => {
    return (data: unknown) => {
      if (JSON.stringify(data) === JSON.stringify(expectedValue)) {
        return ok(expectedValue);
      }
      return err(
        new ErrorWithMetadata('Validation failed', 'InternalServer', {}),
      );
    };
  };

  it('should deserialize and validate JSON string to object', () => {
    const data = '{"name":"John","age":30}';
    const expectedValue = { name: 'John', age: 30 };
    const validator = validatorMock(expectedValue);

    const result = deserializeCacheData(data, validator);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(expectedValue);
    }
  });

  it('should deserialize JSON array', () => {
    const data = '[1,2,3]';
    const expectedValue = [1, 2, 3];
    const validator = validatorMock(expectedValue);

    const result = deserializeCacheData(data, validator);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(expectedValue);
    }
  });

  it('should deserialize nested object', () => {
    const data = '{"user":{"id":"123","name":"Alice"},"active":true}';
    const expectedValue = { user: { id: '123', name: 'Alice' }, active: true };
    const validator = validatorMock(expectedValue);

    const result = deserializeCacheData(data, validator);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(expectedValue);
    }
  });

  it('should return error for invalid JSON', () => {
    const data = '{invalid json}';
    const validator = validatorMock({});

    const result = deserializeCacheData(data, validator);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ErrorWithMetadata);
      expect(result.error.message).toBe('Cache deserialization error');
      expect(result.error.code).toBe('InternalServer');
    }
  });

  it('should return error when validation fails', () => {
    const data = '{"name":"John"}';
    const validator: Validator<{ name: string; age: number }> = () => {
      return err(
        new ErrorWithMetadata('Missing age field', 'InternalServer', {}),
      );
    };

    const result = deserializeCacheData(data, validator);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Missing age field');
    }
  });

  it('should include metadata in error when provided', () => {
    const data = '{invalid}';
    const metadata = { key: 'test-key', id: 'test-id' };
    const validator = validatorMock({});

    const result = deserializeCacheData(data, validator, metadata);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.metadata).toMatchObject(metadata);
    }
  });

  it('should handle empty string as invalid JSON', () => {
    const data = '';
    const validator = validatorMock({});

    const result = deserializeCacheData(data, validator);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Cache deserialization error');
    }
  });
});

describe('convertCacheData', () => {
  const validatorMock = <T>(expectedValue: T): Validator<T> => {
    return (data: unknown) => {
      if (JSON.stringify(data) === JSON.stringify(expectedValue)) {
        return ok(expectedValue);
      }
      return err(
        new ErrorWithMetadata('Validation failed', 'InternalServer', {}),
      );
    };
  };

  it('should return null for cache miss (null input)', () => {
    const validator = validatorMock({ name: 'test' });

    const result = convertCacheData(null, validator);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(null);
    }
  });

  it('should deserialize and validate non-null data', () => {
    const data = '{"name":"John","age":30}';
    const expectedValue = { name: 'John', age: 30 };
    const validator = validatorMock(expectedValue);

    const result = convertCacheData(data, validator);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual(expectedValue);
    }
  });

  it('should return error for invalid JSON', () => {
    const data = '{invalid json}';
    const validator = validatorMock({});

    const result = convertCacheData(data, validator);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Cache deserialization error');
    }
  });

  it('should return error when validation fails', () => {
    const data = '{"name":"John"}';
    const validator: Validator<{ name: string; age: number }> = () => {
      return err(
        new ErrorWithMetadata('Missing age field', 'InternalServer', {}),
      );
    };

    const result = convertCacheData(data, validator);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('Missing age field');
    }
  });

  it('should include metadata in error when provided', () => {
    const data = '{invalid}';
    const metadata = { key: 'test-key', id: 'test-id' };
    const validator = validatorMock({});

    const result = convertCacheData(data, validator, metadata);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.metadata).toMatchObject(metadata);
    }
  });

  it('should handle null metadata gracefully', () => {
    const data = '{"test":"value"}';
    const expectedValue = { test: 'value' };
    const validator = validatorMock(expectedValue);

    const result = convertCacheData(data, validator);

    expect(result.isOk()).toBe(true);
  });
});

describe('round-trip serialization', () => {
  const passThoughValidator: Validator<unknown> = (data: unknown) => ok(data);

  it('should serialize and deserialize object successfully', () => {
    const original = { name: 'Alice', age: 25, active: true };

    const serialized = serializeCacheData(original);
    expect(serialized.isOk()).toBe(true);

    if (serialized.isOk()) {
      const deserialized = deserializeCacheData(
        serialized.value,
        passThoughValidator,
      );
      expect(deserialized.isOk()).toBe(true);

      if (deserialized.isOk()) {
        expect(deserialized.value).toEqual(original);
      }
    }
  });

  it('should serialize and deserialize array successfully', () => {
    const original = [1, 2, 3, 'test', true, null];

    const serialized = serializeCacheData(original);
    expect(serialized.isOk()).toBe(true);

    if (serialized.isOk()) {
      const deserialized = deserializeCacheData(
        serialized.value,
        passThoughValidator,
      );
      expect(deserialized.isOk()).toBe(true);

      if (deserialized.isOk()) {
        expect(deserialized.value).toEqual(original);
      }
    }
  });

  it('should serialize and deserialize nested object successfully', () => {
    const original = {
      user: { id: '123', name: 'Bob' },
      settings: { theme: 'dark', notifications: true },
      tags: ['tag1', 'tag2'],
    };

    const serialized = serializeCacheData(original);
    expect(serialized.isOk()).toBe(true);

    if (serialized.isOk()) {
      const deserialized = deserializeCacheData(
        serialized.value,
        passThoughValidator,
      );
      expect(deserialized.isOk()).toBe(true);

      if (deserialized.isOk()) {
        expect(deserialized.value).toEqual(original);
      }
    }
  });
});
