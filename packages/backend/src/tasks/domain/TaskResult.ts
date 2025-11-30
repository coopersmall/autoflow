import zod from 'zod';

export const taskResultSchema = zod.strictObject({
  success: zod.literal(true),
  output: zod.unknown().optional(),
  duration: zod.number().describe('Processing time in milliseconds'),
});

export type TaskResult = Readonly<zod.infer<typeof taskResultSchema>>;
