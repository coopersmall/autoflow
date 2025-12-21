import type {
  AppError,
  ObjectResponse,
  ObjectStreamPart,
  StandardCompletionsRequest,
  StreamPart,
  StructuredCompletionsRequest,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context';
import type { TextResponse } from '@core/domain/ai/response/completions/result/TextResponse';
import type { Result } from 'neverthrow';
import type { ICompletionsGateway } from '../domain/CompletionsGateway';
import type { CompletionsProvider } from '../providers/CompletionsProviders';
import { completion } from './actions/completion';
import { completionObject } from './actions/completionObject';
import { createCompletionsModel } from './actions/createCompletionsModel';
import { streamCompletion } from './actions/streamCompletion';
import { streamCompletionObject } from './actions/streamCompletionObject';

export function createAISDKCompletionsGateway(): ICompletionsGateway {
  return Object.freeze(new AISDKCompletionsGateway());
}

interface AISDKCompletionsActions {
  completion: typeof completion;
  completionObject: typeof completionObject;
  streamCompletion: typeof streamCompletion;
  streamCompletionObject: typeof streamCompletionObject;
  createCompletionsModel: typeof createCompletionsModel;
}

class AISDKCompletionsGateway implements ICompletionsGateway {
  constructor(
    private readonly actions: AISDKCompletionsActions = {
      completion,
      completionObject,
      streamCompletion,
      streamCompletionObject,
      createCompletionsModel,
    },
  ) {}

  async completion(
    ctx: Context,
    provider: CompletionsProvider,
    request: StandardCompletionsRequest,
  ): Promise<Result<TextResponse, AppError>> {
    const model = this.actions.createCompletionsModel(provider);
    return this.actions.completion(ctx, provider, model, request);
  }

  async completionObject(
    ctx: Context,
    provider: CompletionsProvider,
    request: StructuredCompletionsRequest,
  ): Promise<Result<ObjectResponse, AppError>> {
    const model = this.actions.createCompletionsModel(provider);
    return this.actions.completionObject(ctx, provider, model, request);
  }

  async *streamCompletion(
    ctx: Context,
    provider: CompletionsProvider,
    request: StandardCompletionsRequest,
  ): AsyncGenerator<Result<StreamPart, AppError>> {
    const model = this.actions.createCompletionsModel(provider);
    for await (const part of this.actions.streamCompletion(
      ctx,
      provider,
      model,
      request,
    )) {
      yield part;
    }
  }

  async *streamCompletionObject(
    ctx: Context,
    provider: CompletionsProvider,
    request: StructuredCompletionsRequest,
  ): AsyncGenerator<Result<ObjectStreamPart, AppError>> {
    const model = this.actions.createCompletionsModel(provider);
    for await (const part of this.actions.streamCompletionObject(
      ctx,
      provider,
      model,
      request,
    )) {
      yield part;
    }
  }
}
