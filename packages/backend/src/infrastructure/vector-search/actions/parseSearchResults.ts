import { newId } from '@core/domain/Id';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';
import type {
  VectorDocumentId,
  VectorSearchResult,
} from '../domain/VectorSearchQuery';
import { createVectorStoreSearchError } from '../errors/VectorStoreError';

/**
 * Zod schemas for validating Redis FT.SEARCH response structure.
 * Using progressive validation since the response is a heterogeneous array.
 */
const redisTotalCountSchema = zod.number().int().nonnegative();
const redisKeySchema = zod.string();
const redisFieldArraySchema = zod.array(zod.string());

/**
 * Parses the FT.SEARCH response into typed VectorSearchResult objects.
 * Uses Zod validation for type-safe parsing without assertions.
 *
 * Redis FT.SEARCH response format:
 * [total, key1, [field1, value1, field2, value2, ...], key2, [...], ...]
 */
export function parseSearchResults(
  response: unknown,
  scoreField: string = 'score',
): Result<VectorSearchResult[], AppError> {
  // Validate response is an array
  const arrayResult = validate(zod.array(zod.unknown()), response);
  if (arrayResult.isErr()) {
    return err(
      createVectorStoreSearchError(arrayResult.error, {
        operation: 'parseSearchResults',
        reason: 'Response is not an array',
      }),
    );
  }

  const responseArray = arrayResult.value;

  if (responseArray.length === 0) {
    return ok([]);
  }

  // Validate and extract total count (first element)
  const totalResult = validate(redisTotalCountSchema, responseArray[0]);
  if (totalResult.isErr()) {
    return err(
      createVectorStoreSearchError(totalResult.error, {
        operation: 'parseSearchResults',
        reason: 'Invalid total count',
      }),
    );
  }

  if (totalResult.value === 0) {
    return ok([]);
  }

  const results: VectorSearchResult[] = [];

  // Iterate through key-fields pairs (starting at index 1)
  for (let i = 1; i < responseArray.length; i += 2) {
    const keyElement = responseArray[i];
    const fieldsElement = responseArray[i + 1];

    // Validate key
    const keyResult = validate(redisKeySchema, keyElement);
    if (keyResult.isErr()) {
      return err(
        createVectorStoreSearchError(keyResult.error, {
          operation: 'parseSearchResults',
          reason: 'Invalid key at index',
          index: i,
        }),
      );
    }

    // Validate fields array
    const fieldsResult = validate(redisFieldArraySchema, fieldsElement);
    if (fieldsResult.isErr()) {
      return err(
        createVectorStoreSearchError(fieldsResult.error, {
          operation: 'parseSearchResults',
          reason: 'Invalid fields array at index',
          index: i + 1,
        }),
      );
    }

    // Parse result from validated data
    const parseResult = parseResultFromFields(
      keyResult.value,
      fieldsResult.value,
      scoreField,
    );

    if (parseResult.isErr()) {
      return err(parseResult.error);
    }

    results.push(parseResult.value);
  }

  return ok(results);
}

/**
 * Parses a single search result from validated key and fields.
 */
function parseResultFromFields(
  key: string,
  fields: string[],
  scoreField: string,
): Result<VectorSearchResult, AppError> {
  // Fields come as pairs: [name1, value1, name2, value2, ...]
  if (fields.length % 2 !== 0) {
    return err(
      createVectorStoreSearchError(new Error('Fields array has odd length'), {
        operation: 'parseResultFromFields',
        key,
      }),
    );
  }

  // Build field map from pairs
  const fieldMap: Record<string, string> = {};
  for (let j = 0; j < fields.length; j += 2) {
    const fieldName = fields[j];
    const fieldValue = fields[j + 1];
    if (fieldName !== undefined && fieldValue !== undefined) {
      fieldMap[fieldName] = fieldValue;
    }
  }

  // Extract id from key (last segment after slash) and brand it
  const idString = extractIdFromKey(key);
  const id = newId<VectorDocumentId>(idString);

  // Extract and validate score
  const scoreString = fieldMap[scoreField];
  const scoreResult = parseFloatSafe(scoreString);
  if (scoreResult.isErr()) {
    return err(
      createVectorStoreSearchError(scoreResult.error, {
        operation: 'parseResultFromFields',
        reason: 'Invalid score',
        key,
      }),
    );
  }

  // Extract content (default to empty string if not present)
  const content = fieldMap.content ?? '';

  // Build metadata from remaining fields
  const metadataResult = buildMetadata(fieldMap, scoreField);
  if (metadataResult.isErr()) {
    return err(metadataResult.error);
  }

  return ok({
    id,
    score: scoreResult.value,
    content,
    metadata: metadataResult.value,
  });
}

/**
 * Builds metadata object from field map, excluding score and content fields.
 */
function buildMetadata(
  fieldMap: Record<string, string>,
  scoreField: string,
): Result<Record<string, unknown> | undefined, AppError> {
  const metadata: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(fieldMap)) {
    if (field !== scoreField && field !== 'content') {
      const parseResult = parseFieldValue(value);
      if (parseResult.isErr()) {
        return err(parseResult.error);
      }
      metadata[field] = parseResult.value;
    }
  }

  return ok(Object.keys(metadata).length > 0 ? metadata : undefined);
}

/**
 * Extracts the document ID from a Redis key.
 * Handles both shared (namespace/id) and standard (user/userId/namespace/id) formats.
 */
function extractIdFromKey(key: string): string {
  const parts = key.split('/');
  return parts[parts.length - 1] ?? key;
}

/**
 * Safely parses a float from a string.
 */
function parseFloatSafe(value: string | undefined): Result<number, AppError> {
  if (value === undefined) {
    return ok(0);
  }

  const num = Number.parseFloat(value);

  if (Number.isNaN(num)) {
    return err(
      createVectorStoreSearchError(
        new Error(`Cannot parse "${value}" as float`),
        {
          operation: 'parseFloatSafe',
        },
      ),
    );
  }

  return ok(num);
}

/**
 * Parses a field value to its appropriate type with Result-based error handling.
 * Returns the parsed value (number, boolean, or string).
 */
function parseFieldValue(value: string): Result<unknown, AppError> {
  // Try parsing as number
  const num = Number.parseFloat(value);
  if (!Number.isNaN(num) && Number.isFinite(num)) {
    return ok(num);
  }

  // Try parsing as boolean
  if (value === 'true') return ok(true);
  if (value === 'false') return ok(false);

  // Return as string (always valid)
  return ok(value);
}
