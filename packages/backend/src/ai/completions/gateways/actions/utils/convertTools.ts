import type { ToolWithExecution } from '@autoflow/core';
import { jsonSchema, type ToolSet, tool } from 'ai';

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
    toolSet[t.function.name] = tool({
      description: t.function.description,
      inputSchema: jsonSchema(t.function.parameters),
    });
  }

  return toolSet;
}
