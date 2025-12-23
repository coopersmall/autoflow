import type { ToolWithExecution } from '@autoflow/core';
import {
  dynamicTool,
  jsonSchema,
  type ToolExecutionOptions,
  type ToolSet,
  tool,
} from 'ai';
import { convertFromModelMessages } from './convertMessages';

/**
 * Converts domain ToolWithExecution array to AI SDK ToolSet format.
 *
 * Uses `dynamicTool` for tools with execute functions (accepts unknown input/output)
 * and `tool` for tools without execute functions (schema-only).
 */
export function convertTools(tools?: ToolWithExecution[]): ToolSet | undefined {
  if (!tools || tools.length === 0) {
    return;
  }

  const toolSet: ToolSet = {};

  for (const t of tools) {
    const inputSchema = jsonSchema(t.function.parameters);
    const executeFn = t.execute;

    if (executeFn) {
      // Use dynamicTool for tools with execute - it accepts unknown input/output
      toolSet[t.function.name] = dynamicTool({
        description: t.function.description,
        inputSchema,
        execute: async (input: unknown, options: ToolExecutionOptions) => {
          return executeFn(input, {
            messages: convertFromModelMessages(options.messages),
          });
        },
      });
    } else {
      // Use tool for schema-only tools without execute
      toolSet[t.function.name] = tool({
        description: t.function.description,
        inputSchema,
      });
    }
  }

  return toolSet;
}
