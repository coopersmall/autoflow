import { jsonSchema } from '@core/domain/json-schema/JsonSchema';
import { z as zod } from 'zod';
import { agentIdSchema } from '../AgentId';
import { streamingConfigSchema } from './StreamingConfig';

export const subAgentConfigSchema = zod.strictObject({
  manifestId: agentIdSchema.describe('Reference to sub-agent manifest by ID'),
  manifestVersion: zod.string().describe('Required version for determinism'),
  name: zod.string().describe('Tool name exposed to parent agent'),
  description: zod.string().describe('When to use this sub-agent'),
  parameters: jsonSchema
    .optional()
    .describe('Configurable parameters for the tool'),
  timeout: zod
    .number()
    .optional()
    .describe('Timeout in ms (independent of parent)'),
  // Override sub-agent's streaming config for this invocation
  streaming: streamingConfigSchema
    .optional()
    .describe(
      "Override sub-agent's streaming configuration for this invocation",
    ),
});

// Note: mapToRequest is in hooks, not config (it's a function)
export type SubAgentConfig = zod.infer<typeof subAgentConfigSchema>;

// Default schema for sub-agent tool parameters when no custom schema is provided
export const defaultSubAgentArgsSchema = zod.strictObject({
  prompt: zod.string(),
  context: zod.record(zod.string(), zod.unknown()).optional(),
});
