import type { ToolSet } from 'ai';
import { isEmpty } from 'lodash';

export function mergeToolSets(
  toolSets: (ToolSet | undefined)[],
): ToolSet | undefined {
  const tools = toolSets.reduce<ToolSet>((acc, toolSet) => {
    if (toolSet) {
      Object.assign(acc, toolSet);
    }
    return acc;
  }, {});

  if (isEmpty(tools)) {
    return;
  }

  return tools;
}
