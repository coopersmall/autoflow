import type {
  AppError,
  ObjectResponse,
  ObjectStreamPart,
  StandardCompletionsRequest,
  StreamPart,
  StructuredCompletionsRequest,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context.ts';
import type { TextResponse } from '@core/domain/ai/response/completions/result/TextResponse';
import type { Result } from 'neverthrow';
import type { ICompletionsGateway } from './domain/CompletionsGateway.ts';
import { createAISDKCompletionsGateway } from './gateways/AISDKCompletionsGateway.ts';
import type { CompletionsProvider } from './providers/CompletionsProviders.ts';

export function createCompletionsService(): ICompletionsGateway {
  return Object.freeze(new CompletionsService());
}

interface CompletionsServiceActions {
  createGateway: typeof createAISDKCompletionsGateway;
}

class CompletionsService implements ICompletionsGateway {
  private readonly gateway: ICompletionsGateway;
  constructor(
    private readonly actions: CompletionsServiceActions = {
      createGateway: createAISDKCompletionsGateway,
    },
  ) {
    this.gateway = this.actions.createGateway();
  }

  async completion(
    ctx: Context,
    provider: CompletionsProvider,
    request: StandardCompletionsRequest,
  ): Promise<Result<TextResponse, AppError>> {
    return this.gateway.completion(ctx, provider, request);
  }

  async completionObject(
    ctx: Context,
    provider: CompletionsProvider,
    request: StructuredCompletionsRequest,
  ): Promise<Result<ObjectResponse, AppError>> {
    return this.gateway.completionObject(ctx, provider, request);
  }

  async *streamCompletion(
    ctx: Context,
    provider: CompletionsProvider,
    request: StandardCompletionsRequest,
  ): AsyncGenerator<Result<StreamPart, AppError>> {
    for await (const part of this.gateway.streamCompletion(
      ctx,
      provider,
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
    for await (const part of this.gateway.streamCompletionObject(
      ctx,
      provider,
      request,
    )) {
      yield part;
    }
  }
}
