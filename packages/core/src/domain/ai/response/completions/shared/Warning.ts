import zod from 'zod';

export type Warning = zod.infer<typeof warningSchema>;

/**
 * Warning for when a feature is not supported by the model.
 */
const unsupportedWarningSchema = zod.strictObject({
  type: zod.literal('unsupported'),
  feature: zod.string().describe('The feature that is not supported.'),
  details: zod
    .string()
    .optional()
    .describe('Additional details about the warning.'),
});

/**
 * Warning for when a compatibility feature is used that might lead to suboptimal results.
 */
const compatibilityWarningSchema = zod.strictObject({
  type: zod.literal('compatibility'),
  feature: zod.string().describe('The feature used in compatibility mode.'),
  details: zod
    .string()
    .optional()
    .describe('Additional details about the warning.'),
});

/**
 * Other warning types.
 */
const otherWarningSchema = zod.strictObject({
  type: zod.literal('other'),
  message: zod.string().describe('The warning message.'),
});

export const warningSchema = zod
  .union([
    unsupportedWarningSchema,
    compatibilityWarningSchema,
    otherWarningSchema,
  ])
  .describe('A warning from the model provider.');
