import { agentRunIdSchema } from '@core/domain/agents';
import { z as zod } from 'zod';

/**
 * Signal stored in cache to indicate an agent should be cancelled.
 * Satisfies the Item<ID> constraint required by SharedCache.
 */
export const cancellationSignalSchema = zod.strictObject({
  // Required by Item<ID> constraint
  id: agentRunIdSchema,
  createdAt: zod.date(),
  schemaVersion: zod.number().int().min(1).default(1),

  // Cancellation-specific fields
  cancelledAt: zod.date(), // When cancellation was requested (same as createdAt)
  reason: zod.string().optional(),
});

export type CancellationSignal = zod.infer<typeof cancellationSignalSchema>;
