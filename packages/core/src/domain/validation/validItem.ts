import type { Id } from '@core/domain/Id.ts';
import type { Item } from '@core/domain/Item.ts';
import type { AppError } from '@core/errors/AppError.ts';
import { validate } from '@core/validation/validate.ts';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';
import { idSchema } from './validId.ts';

export const itemSchema = zod.strictObject({
  id: idSchema,
  createdAt: zod.date(),
  updatedAt: zod.date(),
  schemaVersion: zod.literal(1),
});

export function validItem<ID extends Id<string> = Id<string>>(
  input: unknown,
): Result<Item<ID>, AppError> {
  const item = validate(itemSchema, input);
  if (item.isErr()) {
    return err(item.error);
  }
  return ok({
    ...item.value,
    // biome-ignore lint: Required for branded type validation
    id: item.value.id as ID,
  });
}
