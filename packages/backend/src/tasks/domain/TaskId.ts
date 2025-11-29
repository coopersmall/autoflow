import { newId } from '@core/domain/Id';
import zod from 'zod';

export type TaskId = zod.infer<typeof taskIdSchema>;
export const TaskId = newId<TaskId>;

export const taskIdSchema = zod
  .string()
  .brand<'TaskId'>()
  .describe('the id of a task');
