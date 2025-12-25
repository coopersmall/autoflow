import { z as zod } from 'zod';
import { messageSchema } from '../../ai/request/completions/messages/Message';

export const agentRequestSchema = zod.strictObject({
  prompt: zod.union([zod.string(), zod.array(messageSchema)]),
  context: zod.record(zod.string(), zod.unknown()).optional(),
});

export type AgentRequest = zod.infer<typeof agentRequestSchema>;
