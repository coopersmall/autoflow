import type { AIServiceConfig } from '@backend/ai/AIService';
import type { AiProviderIntegration } from '@core/domain/integrations/ai/providers/AiProviderIntegration';
import type { ExtractMethods } from '@core/types';
import {
  type GenerateObjectResult,
  generateObject,
  type ModelMessage,
} from 'ai';
import type { Schema } from 'zod';
import { getModel } from './getModel.ts';

export interface CompletionObjectRequest<SCHEMA extends Schema> {
  provider: AiProviderIntegration;
  model: string;
  messages: ModelMessage[];
  schema: SCHEMA;
  temperature?: number;
}

export type CompletionObjectResult<RESULT> = GenerateObjectResult<RESULT>;

export async function completionObject<SCHEMA extends Schema, RESULT>(
  _ctx: ExtractMethods<AIServiceConfig>,
  {
    provider,
    model,
    messages,
    schema,
    temperature = 0.0,
  }: CompletionObjectRequest<SCHEMA>,
  actions = {
    generateObject,
    getModel,
  },
): Promise<CompletionObjectResult<RESULT>> {
  const aiModel = actions.getModel({ provider, model });
  const response = await actions.generateObject({
    model: aiModel,
    schema,
    messages,
    temperature,
  });
  return response;
}
