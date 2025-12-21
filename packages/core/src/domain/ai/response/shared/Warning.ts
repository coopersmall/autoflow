import zod from 'zod';

export type Warning = zod.infer<typeof warningSchema>;

const unsupportedSettingWarningSchema = zod.strictObject({
  type: zod.literal('unsupported-setting'),
  setting: zod.unknown(),
  details: zod.string().optional(),
});

const unsupportedToolWarningSchema = zod.strictObject({
  type: zod.literal('unsupported-tool'),
  tool: zod.unknown(),
  details: zod.string().optional(),
});

const otherWarningSchema = zod.strictObject({
  type: zod.literal('other'),
  message: zod.string(),
});

export const warningSchema = zod
  .union([
    unsupportedSettingWarningSchema,
    unsupportedToolWarningSchema,
    otherWarningSchema,
  ])
  .describe('A warning from the model provider.');
