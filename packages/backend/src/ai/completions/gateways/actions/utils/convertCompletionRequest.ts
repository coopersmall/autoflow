import type { StandardCompletionsRequest } from '@autoflow/core';
import type { JSONValue, ModelMessage, ToolSet } from 'ai';
import type { CompletionsProvider } from '../../../providers/CompletionsProviders.ts';
import { convertBuiltinTools } from './convertBuiltinTools.ts';
import { convertMessages } from './convertMessages.ts';
import { convertProviderOptions } from './convertProviderOptions.ts';
import { convertTools } from './convertTools.ts';
import { mergeToolSets } from './mergeToolSets.ts';

type CompletionRequest = Omit<
  StandardCompletionsRequest,
  'messages' | 'tools'
> & {
  messages: ModelMessage[];
  tools?: ToolSet;
  providerOptions?: Record<string, Record<string, JSONValue>>;
};

export function convertCompletionRequest(
  provider: CompletionsProvider,
  request: StandardCompletionsRequest,
): CompletionRequest {
  const { messages, tools } = request;

  const requestTools = convertTools(tools);
  const builtinTools = convertBuiltinTools(provider);

  return {
    ...request,
    messages: convertMessages(messages),
    tools: mergeToolSets([requestTools, builtinTools]),
    providerOptions: convertProviderOptions(provider),
  };
}
