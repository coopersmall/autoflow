import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ExtractMethods } from '@core/types';
import type { ToolSet } from 'ai';
import type { Schema } from 'zod';
import { type CompletionRequest, completion } from './actions/completion';
import {
  type CompletionObjectRequest,
  completionObject,
} from './actions/completionObject';
import {
  type StreamCompletionRequest,
  streamCompletion,
} from './actions/streamCompletion';
import {
  type StreamCompletionObjectRequest,
  streamCompletionObject,
} from './actions/streamCompletionObject';

export type IAIService = ExtractMethods<AIService>;

export function createAIService(context: AIServiceContext): IAIService {
  return Object.freeze(new AIService(context));
}

export interface AIServiceContext {
  appConfig: () => IAppConfigurationService;
}

class AIService {
  constructor(
    private readonly context: AIServiceContext,
    private readonly actions = {
      completion,
      completionObject,
      streamCompletion,
      streamCompletionObject,
    },
  ) {}

  async completion<TOOLS extends ToolSet>(request: CompletionRequest<TOOLS>) {
    return this.actions.completion(this.context, request);
  }

  async completionObject<SCHEMA extends Schema>(
    request: CompletionObjectRequest<SCHEMA>,
  ) {
    return this.actions.completionObject(this.context, request);
  }

  streamCompletion<TOOLS extends ToolSet>(
    request: StreamCompletionRequest<TOOLS>,
  ) {
    return this.actions.streamCompletion(this.context, request);
  }

  streamCompletionObject<SCHEMA extends Schema>(
    request: StreamCompletionObjectRequest<SCHEMA>,
  ) {
    return this.actions.streamCompletionObject(this.context, request);
  }
}
