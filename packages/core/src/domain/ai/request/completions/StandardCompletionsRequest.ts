import zod from 'zod';
import { mcpServerConfigSchema } from '../../mcp';
import { baseCompletionsRequestSchema } from './BaseCompletionsRequest';
import {
  onStepFinishFunctionSchema,
  prepareStepFunctionSchema,
  stopWhenSchema,
} from './hooks';
import { toolSchema } from './tools';
import { toolChoiceSchema } from './tools/ToolChoice';

export type StandardCompletionsRequest = zod.infer<
  typeof standardCompletionsRequestSchema
>;

export const standardCompletionsRequestSchema = baseCompletionsRequestSchema
  .extend({
    tools: zod
      .array(toolSchema)
      .optional()
      .describe('Tools available for the model to call.'),
    activeTools: zod
      .array(zod.string())
      .optional()
      .describe(
        'List of tool names that are active for this request. If not provided, all tools are active.',
      ),
    stopWhen: zod
      .array(stopWhenSchema)
      .optional()
      .describe('Conditions to stop generation.'),
    toolChoice: toolChoiceSchema,
    prepareStep: prepareStepFunctionSchema
      .optional()
      .describe(
        'Optional function to provide different settings for each step. Can modify tool choice, active tools, system prompt, and messages.',
      ),
    onStepFinish: onStepFinishFunctionSchema
      .optional()
      .describe('Callback that is called when a step is finished.'),
    /**
     * MCP server configurations. If provided, the CompletionsService will:
     * 1. Create MCP clients for each config
     * 2. Retrieve tools from each server
     * 3. Merge with request.tools
     * 4. Close clients when the request completes
     */
    mcpServers: zod
      .array(mcpServerConfigSchema)
      .optional()
      .describe('MCP servers to connect to and retrieve tools from.'),
  })
  .describe('Standard completions request with optional tool calling.');
