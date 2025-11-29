import { nanoid } from 'nanoid';
import type zod from 'zod';

export type Id<T extends string> = string & zod.BRAND<T>;
export const newId = <T>(value?: string): T => {
  // biome-ignore lint: Required for branded type factory pattern
  return (value || nanoid()) as T;
};
