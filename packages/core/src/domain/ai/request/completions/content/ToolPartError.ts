import zod from 'zod';

export const requestToolErrorPartSchema = zod.strictObject({
  type: zod.literal('tool-error'),
  toolCallId: zod.string(),
  toolName: zod.string(),
  input: zod.unknown(),
  error: zod.unknown(),
});
