import { z as zod } from 'zod';
import { mcpServerConfigSchema } from '../../ai/mcp/MCPServerConfig';
import {
  anthropicProviderSchema,
  googleProviderSchema,
  openAIProviderSchema,
} from '../../ai/providers/AIProviders';
import { stopWhenSchema } from '../../ai/request/completions/hooks/stopWhen/StopWhen';
import { toolSchema } from '../../ai/request/completions/tools/Tool';
import { agentIdSchema } from '../AgentId';
import { outputToolConfigSchema } from './OutputToolConfig';
import { type StreamingConfig, streamingConfigSchema } from './StreamingConfig';
import { subAgentConfigSchema } from './SubAgentConfig';

// Re-export for backwards compatibility
export { streamingConfigSchema, type StreamingConfig };

// Provider config for agents (subset of CompletionsProvider)
export const agentProviderConfigSchema = zod.discriminatedUnion('provider', [
  openAIProviderSchema,
  anthropicProviderSchema,
  googleProviderSchema,
]);

export type AgentProviderConfig = zod.infer<typeof agentProviderConfigSchema>;

export const agentManifestConfigSchema = zod.strictObject({
  id: agentIdSchema.describe('Unique identifier for this agent type'),
  version: zod
    .string()
    .regex(
      /^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/,
      'Version must be a valid semantic version (e.g., 1.0.0)',
    )
    .describe('Semantic version for deployment compatibility'),
  name: zod.string().describe('Human-readable name'),
  description: zod.string().describe('What this agent does'),

  // LLM Configuration
  provider: agentProviderConfigSchema.describe('Provider and model'),
  instructions: zod.string().describe('System prompt for the agent'),

  // Tools (definitions only - executors are in hooks)
  tools: zod.array(toolSchema).optional(),
  mcpServers: zod.array(mcpServerConfigSchema).optional(),
  subAgents: zod.array(subAgentConfigSchema).optional(),

  // Structured Output
  outputTool: outputToolConfigSchema.optional(),

  // Loop Control (reuses existing StopWhen from completions)
  stopWhen: zod
    .array(stopWhenSchema)
    .optional()
    .describe(
      'Stop conditions. Default: [{ type: "stepCount", stepCount: 20 }]',
    ),
  onTextOnly: zod
    .enum(['stop', 'continue'])
    .default('stop')
    .describe('Behavior when model generates text without tool calls'),

  // Timeout
  timeout: zod
    .number()
    .optional()
    .describe(
      'Maximum execution time in ms (excludes suspended time). Default: 300000 (5 min)',
    ),

  // Error Handling
  onError: zod
    .strictObject({
      retry: zod.boolean().default(false),
      maxRetries: zod.number().default(1),
      includeErrorInRetry: zod.boolean().default(true),
    })
    .optional(),

  // Human-in-the-Loop
  humanInTheLoop: zod
    .strictObject({
      // Tools that always require approval (by name)
      alwaysRequireApproval: zod.array(zod.string()).optional(),
      // If true, ALL tools require approval unless explicitly excluded
      defaultRequiresApproval: zod.boolean().default(false),
    })
    .optional(),

  // Sub-agent settings
  subAgentDefaults: zod
    .strictObject({
      timeout: zod
        .number()
        .optional()
        .describe('Default timeout for sub-agents (ms)'),
    })
    .optional(),

  // Streaming configuration
  streaming: streamingConfigSchema
    .optional()
    .describe(
      "Streaming configuration. Defaults to streaming ['tool-call'] events.",
    ),
});

export type AgentManifestConfig = zod.infer<typeof agentManifestConfigSchema>;
