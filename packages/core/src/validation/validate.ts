import type { AppError } from '@core/errors/AppError';
import { validationError } from '@core/errors/factories';
import { isEmpty } from 'lodash';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';

/**
 * A Validator is a function that takes unknown data and returns a Result
 * containing either the validated data of type T or an AppError.
 */
export type Validator<T> = (data: unknown) => Result<T, AppError>;

/**
 * Validates the input against the provided Zod schema.
 * @param schema - Zod schema to validate against.
 * @param input - Input data to validate.
 * @returns Result containing the validated output or an AppError.
 */
export function validate<Output, Input = unknown>(
  schema: zod.ZodType<Output, zod.ZodTypeDef, Input>,
  input: Input,
): Result<Output, AppError> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return err(validationError(result.error));
  }
  return ok(result.data);
}

/*
 * Primative validators
 */

/**
 * Validates that the input is a string.
 */
export function string(input: unknown): Result<string, AppError> {
  return validate(zod.string(), input);
}

/**
 * Validates that the input is a number.
 */
export function number(input: unknown): Result<number, AppError> {
  return validate(zod.number(), input);
}

/**
 * Validates that the input is a boolean.
 */
export function boolean(input: unknown): Result<boolean, AppError> {
  return validate(zod.boolean(), input);
}

/**
 * Validates that the input is a Date.
 */
export function date(input: unknown): Result<Date, AppError> {
  return validate(zod.coerce.date(), input);
}

/*
 * Composite validators
 */

/**
 * Validates that the input is either undefined or passes the provided valueValidator.
 * @param valueValidator - Validator function for the value.
 * @returns A Validator for T | undefined.
 */
export function optional<T>(
  valueValidator: Validator<T>,
): Validator<T | undefined> {
  return (data: unknown): Result<T | undefined, AppError> => {
    if (isEmpty(data)) {
      return ok(undefined);
    }
    return valueValidator(data);
  };
}

/**
 * Validates that the input is a record with string keys and values validated by the provided valueValidator.
 * @param valueValidator - Validator function for the record's values.
 * @returns A Validator for Record<string, V>.
 */
export function record<V>(
  valueValidator: Validator<V>,
): Validator<Record<string, V>> {
  return (data: unknown): Result<Record<string, V>, AppError> => {
    const recordResult = validate(zod.record(zod.unknown()), data);
    if (recordResult.isErr()) {
      return err(recordResult.error);
    }

    let resultRecord: Record<string, V> = {};
    const errors: AppError[] = [];

    resultRecord = Object.entries(recordResult.value).reduce(
      (acc, [key, value]) => {
        const valueResult = valueValidator(value);

        if (valueResult.isErr()) {
          errors.push(valueResult.error);
          return acc;
        }
        // biome-ignore lint: Assignment to acc is intentional here
        acc[key] = valueResult.value;
        return acc;
      },
      resultRecord,
    );

    return ok(resultRecord);
  };
}

/**
 * Validates that the input is an array with items validated by the provided itemValidator.
 * @param itemValidator - Validator function for the array's items.
 * @return A Validator for T[].
 */
export function array<T>(itemValidator: Validator<T>): Validator<T[]> {
  return (data: unknown): Result<T[], AppError> => {
    const arrayResult = validate(zod.array(zod.unknown()), data);
    if (arrayResult.isErr()) {
      return err(arrayResult.error);
    }

    const items: T[] = [];
    for (const item of arrayResult.value) {
      const itemResult = itemValidator(item);
      if (itemResult.isErr()) {
        return err(itemResult.error);
      }
      items.push(itemResult.value);
    }

    return ok(items);
  };
}
