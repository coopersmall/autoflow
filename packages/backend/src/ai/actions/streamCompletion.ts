import type { AIServiceContext } from '@backend/ai/AIService';
import type { AiProviderIntegration } from '@core/domain/integrations/ai/providers/AiProviderIntegration';
import {
  type ModelMessage,
  type StreamTextResult,
  streamText,
  type ToolChoice,
  type ToolSet,
} from 'ai';
import { getModel } from './getModel.ts';

export interface StreamCompletionRequest<TOOLS extends ToolSet> {
  provider: AiProviderIntegration;
  model: string;
  messages: ModelMessage[];
  tools?: TOOLS;
  toolChoice?: ToolChoice<TOOLS>;
  temperature?: number;
}

export type StreamCompletionResult<
  TOOLS extends ToolSet,
  TOOL_RESULT,
> = StreamTextResult<TOOLS, TOOL_RESULT>;

export function streamCompletion<TOOLS extends ToolSet, TOOL_RESULT>(
  _ctx: AIServiceContext,
  {
    provider,
    model,
    messages,
    tools,
    toolChoice,
    temperature = 0.0,
  }: StreamCompletionRequest<TOOLS>,
  actions = {
    streamText,
    getModel,
  },
): StreamCompletionResult<TOOLS, TOOL_RESULT> {
  const aiModel = actions.getModel({ provider, model });
  const response = actions.streamText({
    model: aiModel,
    messages,
    tools,
    toolChoice,
    temperature,
  });
  return response;
}
