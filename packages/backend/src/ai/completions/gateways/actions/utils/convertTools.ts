import type { ExecuteFunction, Tool } from '@autoflow/core';
import {
  jsonSchema,
  type ToolCallOptions,
  type ToolExecuteFunction,
  type ToolSet,
  tool,
} from 'ai';
import { convertFromModelMessages } from './convertMessages';

interface ToolWithExecute extends Tool {
  execute?: ExecuteFunction;
}

export function convertTools(tools?: ToolWithExecute[]): ToolSet | undefined {
  if (!tools || tools.length === 0) {
    return;
  }
  return tools.reduce<ToolSet>((toolSet, t) => {
    const inputSchema = jsonSchema(t.function.parameters);
    toolSet[t.function.name] = tool({
      ...t.function,
      inputSchema,
    });

    const executeFn = convertExecuteFunction(t.execute);
    if (executeFn) {
      toolSet[t.function.name].execute = executeFn;
    }

    return toolSet;
  }, {});
}

function convertExecuteFunction(
  fn?: ExecuteFunction,
): ToolExecuteFunction<unknown, ToolCallOptions> | undefined {
  if (!fn) {
    return;
  }
  return async (input: unknown, options: ToolCallOptions) => {
    return fn(input, {
      messages: convertFromModelMessages(options.messages),
    });
  };
}
