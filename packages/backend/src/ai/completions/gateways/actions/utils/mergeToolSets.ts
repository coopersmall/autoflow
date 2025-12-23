import type { ToolSet } from 'ai';
import { isEmpty } from 'lodash';

/**
 * Merges multiple tool sets into a single object.
 *
 * Note: We use a generic Record type here because provider builtin tools
 * and user-defined tools have different type structures. The AI SDK's
 * generateText/streamText functions accept tools with compatible runtime
 * structure even if TypeScript types differ.
 */
export function mergeToolSets(
  toolSets: (ToolSet | undefined)[],
): ToolSet | undefined {
  const toolSet: ToolSet = {};
  const tools = toolSets.reduce((acc, toolSet) => {
    if (toolSet && acc) {
      Object.assign(acc, toolSet);
    }
    return acc;
  }, toolSet);

  if (isEmpty(tools)) {
    return;
  }

  return tools;
}
