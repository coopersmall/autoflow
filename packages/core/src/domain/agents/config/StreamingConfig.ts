import { z as zod } from 'zod';
import { streamableEventTypeSchema } from '../execution/AgentEvent';

/**
 * Configuration for streaming behavior.
 * Controls which events are emitted during agent execution.
 */
export const streamingConfigSchema = zod.strictObject({
  // Which events this agent streams
  // Applies whether running as root or sub-agent
  events: zod
    .array(streamableEventTypeSchema)
    .default(['tool-call'])
    .describe('Which event types to stream'),
});

export type StreamingConfig = zod.infer<typeof streamingConfigSchema>;
