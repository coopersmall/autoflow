import zod from 'zod';

export const taskErrorSchema = zod.strictObject({
  success: zod.literal(false),
  reason: zod.string().describe('Error message'),
  stackTrace: zod.string().optional(),
  lastAttemptAt: zod.coerce.date(),
});

export type TaskError = Readonly<zod.infer<typeof taskErrorSchema>>;
