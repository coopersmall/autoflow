import zod from 'zod';

export const taskErrorSchema = zod.strictObject({
  success: zod.literal(false),
  reason: zod.string().describe('Error message'),
  stackTrace: zod.string().optional(),
  lastAttemptAt: zod.coerce.date(),
});

export type TaskError = zod.infer<typeof taskErrorSchema>;
