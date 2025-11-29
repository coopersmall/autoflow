import zod from 'zod';

export const taskPrioritySchema = zod.enum([
  'low',
  'normal',
  'high',
  'critical',
]);

export type TaskPriority = zod.infer<typeof taskPrioritySchema>;
