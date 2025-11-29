import zod from 'zod';

export const taskStatusSchema = zod.enum([
  'pending', // Queued, waiting to start
  'active', // Currently processing
  'completed', // Successfully finished
  'failed', // Permanently failed (all retries exhausted)
  'delayed', // Scheduled for future execution
  'cancelled', // Manually cancelled
]);

export type TaskStatus = zod.infer<typeof taskStatusSchema>;
