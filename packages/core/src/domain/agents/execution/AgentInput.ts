import { z as zod } from 'zod';
import { messageSchema } from '../../ai/request/completions/messages/Message';
import { agentRunIdSchema } from '../AgentRunId';
import { continueResponseSchema } from '../suspension/ContinueResponse';
import { agentRequestSchema } from './AgentRequest';

/**
 * Discriminated union for agent execution input.
 *
 * - `request`: Fresh start with a new agent request
 * - `reply`: Continue a completed agent with additional user message
 * - `approval`: Resume a suspended agent after HITL approval
 */
export const agentInputSchema = zod.discriminatedUnion('type', [
  zod.strictObject({
    type: zod.literal('request'),
    request: agentRequestSchema,
  }),
  zod.strictObject({
    type: zod.literal('reply'),
    runId: agentRunIdSchema,
    message: zod.union([zod.string(), messageSchema]),
  }),
  zod.strictObject({
    type: zod.literal('approval'),
    runId: agentRunIdSchema,
    response: continueResponseSchema,
  }),
]);

export type AgentInput = zod.infer<typeof agentInputSchema>;
