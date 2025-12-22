import type { StandardCompletionsRequest } from '@autoflow/core';
import type {
  GenerateTextOnStepFinishCallback,
  JSONValue,
  ModelMessage,
  PrepareStepFunction,
  StopCondition,
  ToolSet,
} from 'ai';
import type { CompletionsProvider } from '../../../providers/CompletionsProviders';
import { convertBuiltinTools } from './convertBuiltinTools';
import { convertOnStepFinish, convertPrepareStep } from './convertHooks';
import { convertToModelMessages } from './convertMessages';
import { convertProviderOptions } from './convertProviderOptions';
import { convertStopWhen } from './convertStopWhen';
import { convertTools } from './convertTools';
import { mergeToolSets } from './mergeToolSets';

type CompletionRequest = {
  messages: ModelMessage[];
  tools?: ToolSet;
  stopWhen?: StopCondition<ToolSet>[];
  prepareStep?: PrepareStepFunction<ToolSet>;
  onStepFinish?: GenerateTextOnStepFinishCallback<ToolSet>;
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
    messages: convertToModelMessages(messages),
    tools: mergeToolSets([requestTools, builtinTools]),
    stopWhen: convertStopWhen(request.stopWhen),
    prepareStep: convertPrepareStep(request.prepareStep),
    onStepFinish: convertOnStepFinish(request.onStepFinish),
    providerOptions: convertProviderOptions(provider),
  };
}
