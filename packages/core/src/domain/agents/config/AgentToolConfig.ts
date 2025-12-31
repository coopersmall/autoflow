import { z as zod } from 'zod';
import { toolSchema } from '../../ai/request/completions/tools/Tool';
import { toolMiddlewareConfigSchema } from './ToolMiddlewareConfig';

/**
 * Agent tool configuration - extends base tool with agent-specific fields.
 */
export const agentToolConfigSchema = toolSchema.extend({
  middleware: zod
    .array(toolMiddlewareConfigSchema)
    .optional()
    .describe('Middleware applied to this tool execution'),
});

export type AgentToolConfig = zod.infer<typeof agentToolConfigSchema>;
