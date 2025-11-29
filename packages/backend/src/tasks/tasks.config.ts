import type { TaskDefinition } from './domain/TaskDefinition';

/**
 * Central configuration of all tasks in the system.
 *
 * To add a new task:
 * 1. Create a task file using defineTask() in the appropriate service's tasks/ folder
 * 2. Import it here
 * 3. Add it to the allTasks array
 *
 * This array is used by the worker entry point to start workers for all tasks.
 */
export const tasks: TaskDefinition<unknown>[] = [
  // Add more tasks here as they are created
];
