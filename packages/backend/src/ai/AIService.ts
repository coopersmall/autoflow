import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { TextResponse } from '@core/domain/ai/response/index.ts';
import type { ExtractMethods } from '@core/types';
import type { ToolSet } from 'ai';
import type { Schema } from 'zod';
import { type CompletionRequest, completion } from './actions/completion.ts';
import {
  type CompletionObjectRequest,
  completionObject,
} from './actions/completionObject.ts';
import {
  type StreamCompletionRequest,
  streamCompletion,
} from './actions/streamCompletion.ts';
import {
  type StreamCompletionObjectRequest,
  streamCompletionObject,
} from './actions/streamCompletionObject.ts';

export type IAIService = ExtractMethods<AIService>;

export function createAIService(config: AIServiceConfig): IAIService {
  return Object.freeze(new AIService(config));
}

export interface AIServiceConfig {
  appConfig: IAppConfigurationService;
}

interface AIServiceActions {
  completion: typeof completion;
  completionObject: typeof completionObject;
  streamCompletion: typeof streamCompletion;
  streamCompletionObject: typeof streamCompletionObject;
}

class AIService {
  constructor(
    private readonly config: AIServiceConfig,
    private readonly actions: AIServiceActions = {
      completion,
      completionObject,
      streamCompletion,
      streamCompletionObject,
    },
  ) {}

  async completion(request: CompletionRequest): TextResponse {
    return this.actions.completion(this.config, request);
  }

  async completionObject<SCHEMA extends Schema>(
    request: CompletionObjectRequest<SCHEMA>,
  ) {
    return this.actions.completionObject(this.config, request);
  }

  streamCompletion<TOOLS extends ToolSet>(
    request: StreamCompletionRequest<TOOLS>,
  ) {
    return this.actions.streamCompletion(this.config, request);
  }

  streamCompletionObject<SCHEMA extends Schema>(
    request: StreamCompletionObjectRequest<SCHEMA>,
  ) {
    return this.actions.streamCompletionObject(this.config, request);
  }
}
