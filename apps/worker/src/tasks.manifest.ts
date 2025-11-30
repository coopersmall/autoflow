import type { TaskDefinition } from '@autoflow/backend/tasks';

/**
 * All background tasks that this worker processes.
 *
 * This is the single source of truth for all background tasks
 * handled by this worker application.
 *
 * To add a new task:
 * 1. Create a task using defineTask() in the appropriate feature module
 *    (e.g., packages/backend/src/integrations/tasks/syncIntegrations.ts)
 * 2. Export it from the feature module's index.ts
 * 3. Import it here
 * 4. Add it to the tasks array
 *
 * @example
 * ```typescript
 * // In packages/backend/src/integrations/tasks/syncIntegrations.ts
 * import { defineTask } from '@backend/tasks';
 *
 * export const syncIntegrationsTask = defineTask({
 *   queueName: 'integrations:sync',
 *   validator: validSyncPayload,
 *   handler: async (payload, ctx) => {
 *     // Task implementation
 *   },
 * });
 *
 * // In packages/backend/src/integrations/index.ts
 * export { syncIntegrationsTask } from './tasks/syncIntegrations';
 *
 * // In this file
 * import { syncIntegrationsTask } from '@autoflow/backend/integrations';
 *
 * export const tasks: TaskDefinition<unknown>[] = [
 *   syncIntegrationsTask, // <- Add here
 * ];
 * ```
 */
export const tasks: TaskDefinition<unknown>[] = [
  // Add task definitions here as they are created
];
