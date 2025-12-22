import { nanoid } from 'nanoid';
import zod from 'zod';

export type Id<T extends string> = string & zod.BRAND<T>;

export function createIdSchema<T extends string>(
  name: T,
): zod.ZodBranded<zod.ZodString, T> {
  return zod
    .string()
    .min(1, `${name} must not be empty`)
    .brand<T>()
    .describe(`a unique identifier for a ${name}`);
}

export const newId = <T>(value?: string): T => {
  // biome-ignore lint: Required for branded type factory pattern
  return (value || nanoid()) as T;
};
