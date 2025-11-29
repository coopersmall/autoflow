import zod from 'zod';

export const taskStatsSchema = zod.strictObject({
  pending: zod.number().int().min(0).describe('Number of pending tasks'),
  active: zod.number().int().min(0).describe('Number of active tasks'),
  completed: zod.number().int().min(0).describe('Number of completed tasks'),
  failed: zod.number().int().min(0).describe('Number of failed tasks'),
  delayed: zod.number().int().min(0).describe('Number of delayed tasks'),
  cancelled: zod.number().int().min(0).describe('Number of cancelled tasks'),
  total: zod.number().int().min(0).describe('Total number of tasks'),
});

export type TaskStats = zod.infer<typeof taskStatsSchema>;

export function newTaskStats(): TaskStats {
  return {
    pending: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    cancelled: 0,
    total: 0,
  };
}
