import type { AIServiceContext } from '@backend/ai/AIService';
import type { AiProviderIntegration } from '@core/domain/integrations/ai/providers/AiProviderIntegration';
import type { ExtractMethods } from '@core/types';
import { type ModelMessage, type StreamObjectResult, streamObject } from 'ai';
import type { Schema } from 'zod';
import { getModel } from './getModel';

export interface StreamCompletionObjectRequest<SCHEMA extends Schema> {
  provider: AiProviderIntegration;
  model: string;
  messages: ModelMessage[];
  schema: SCHEMA;
  temperature?: number;
}

export type StreamCompletionObjectResult<PARTIAL, RESULT, STREAM_ELEMENT> =
  StreamObjectResult<PARTIAL, RESULT, STREAM_ELEMENT>;

export function streamCompletionObject<SCHEMA extends Schema>(
  _ctx: ExtractMethods<AIServiceContext>,
  {
    provider,
    model,
    messages,
    schema,
    temperature = 0.0,
  }: StreamCompletionObjectRequest<SCHEMA>,
  actions = {
    streamObject,
    getModel,
  },
) {
  const aiModel = actions.getModel({ provider, model });
  const response = actions.streamObject({
    model: aiModel,
    schema,
    messages,
    temperature,
  });
  return response;
}
