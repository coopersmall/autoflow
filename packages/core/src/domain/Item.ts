import zod from 'zod';
import type { Id } from './Id';

export interface Item<ID extends Id<string> = Id<string>> {
  id: ID;
  createdAt: Date;
  updatedAt?: Date;
  schemaVersion: number;
}

export function createItemSchema<
  ID extends string,
  T extends zod.ZodBranded<zod.ZodString, ID>,
>(
  idSchema: T,
): zod.ZodObject<{
  id: T;
  createdAt: zod.ZodDate;
  updatedAt: zod.ZodOptional<zod.ZodDate>;
  schemaVersion: zod.ZodNumber;
}> {
  return zod.strictObject({
    id: idSchema,
    createdAt: zod.coerce.date().describe('the date when the item was created'),
    updatedAt: zod.coerce
      .date()
      .optional()
      .describe('the date when the item was last updated'),
    schemaVersion: zod
      .number()
      .int()
      .min(1)
      .describe('the schema version of the item'),
  });
}
