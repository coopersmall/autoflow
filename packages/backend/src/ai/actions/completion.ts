import type { AIServiceContext } from '@backend/ai/AIService';
import type { AiProviderIntegration } from '@core/domain/integrations/ai/providers/AiProviderIntegration';
import type { ExtractMethods } from '@core/types';
import {
  type GenerateTextResult,
  generateText,
  type ModelMessage,
  type ToolChoice,
  type ToolSet,
} from 'ai';
import { getModel } from './getModel.ts';

export interface CompletionRequest<TOOLS extends ToolSet> {
  provider: AiProviderIntegration;
  model: string;
  messages: ModelMessage[];
  tools?: TOOLS;
  toolChoice?: ToolChoice<TOOLS>;
  temperature?: number;
}

export type CompletionResult<
  TOOLS extends ToolSet,
  TOOL_RESULT,
> = GenerateTextResult<TOOLS, TOOL_RESULT>;

export async function completion<TOOLS extends ToolSet, TOOL_RESULT>(
  _ctx: ExtractMethods<AIServiceContext>,
  {
    provider,
    model,
    messages,
    tools,
    toolChoice,
    temperature = 0.0,
  }: CompletionRequest<TOOLS>,
  actions = {
    generateText,
    getModel,
  },
): Promise<CompletionResult<TOOLS, TOOL_RESULT>> {
  const aiModel = actions.getModel({ provider, model });
  const response = await actions.generateText({
    model: aiModel,
    messages,
    tools,
    toolChoice,
    temperature,
  });
  return response;
}
