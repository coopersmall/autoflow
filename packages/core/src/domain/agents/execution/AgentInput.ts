import { z as zod } from 'zod';
import { messageSchema } from '../../ai/request/completions/messages/Message';
import { agentRunIdSchema } from '../AgentRunId';
import type { AgentManifest } from '../config/AgentManifest';
import { continueResponseSchema } from '../suspension/ContinueResponse';
import { agentRequestSchema } from './AgentRequest';
import { agentRunOptionsSchema } from './AgentRunOptions';

/**
 * Base schema for all agent input variants.
 * Contains the manifestMap needed for sub-agent lookup.
 */
const agentInputBaseSchema = zod.strictObject({
  manifestMap: zod.map(zod.string(), zod.custom<AgentManifest>()),
  options: agentRunOptionsSchema.optional(),
});

/**
 * Discriminated union for agent execution input.
 *
 * All variants include manifestMap for sub-agent resolution.
 *
 * - `request`: Fresh start with a new agent request
 * - `reply`: Continue a completed agent with additional user message
 * - `approval`: Resume a suspended agent after HITL approval
 * - `continue`: Resume agent with pending tool results (no approval needed)
 */
export const agentInputSchema = zod.discriminatedUnion('type', [
  agentInputBaseSchema.extend({
    type: zod.literal('request'),
    request: agentRequestSchema,
  }),
  agentInputBaseSchema.extend({
    type: zod.literal('reply'),
    runId: agentRunIdSchema,
    message: zod.union([zod.string(), messageSchema]),
  }),
  agentInputBaseSchema.extend({
    type: zod.literal('approval'),
    runId: agentRunIdSchema,
    response: continueResponseSchema,
  }),
  agentInputBaseSchema.extend({
    type: zod.literal('continue'),
    runId: agentRunIdSchema,
  }),
]);

export type AgentInput = zod.infer<typeof agentInputSchema>;
