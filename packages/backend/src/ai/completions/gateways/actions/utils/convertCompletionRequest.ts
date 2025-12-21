import type { StandardCompletionsRequest } from '@autoflow/core';
import type { JSONValue, ModelMessage, ToolSet } from 'ai';
import type { CompletionsProvider } from '../../../providers/CompletionsProviders';
import { convertBuiltinTools } from './convertBuiltinTools';
import { convertMessages } from './convertMessages';
import { convertProviderOptions } from './convertProviderOptions';
import { convertTools } from './convertTools';
import { mergeToolSets } from './mergeToolSets';

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
