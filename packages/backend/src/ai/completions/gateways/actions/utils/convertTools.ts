import type { Tool } from '@autoflow/core';
import { jsonSchema, type ToolSet } from 'ai';

export function convertTools(tools?: Tool[]): ToolSet | undefined {
  if (!tools || tools.length === 0) {
    return;
  }
  return tools.reduce<ToolSet>((toolSet, tool) => {
    toolSet[tool.function.name] = {
      name: tool.function.name,
      description: tool.function.description,
      inputSchema: jsonSchema(tool.function.parameters),
    };
    return toolSet;
  }, {});
}
