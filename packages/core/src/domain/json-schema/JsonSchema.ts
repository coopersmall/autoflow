import Ajv from 'ajv';
import type { JSONSchema7 } from 'json-schema';
import zod from 'zod';

export const jsonSchema = zod.custom<JSONSchema7>((val) => {
  if (typeof val !== 'object' || val === null) return false;
  const ajv = new Ajv();
  try {
    ajv.compile(val);
    return true;
  } catch {
    return false;
  }
});
