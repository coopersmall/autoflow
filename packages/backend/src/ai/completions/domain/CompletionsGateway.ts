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
import type { CompletionsProvider } from '../providers/CompletionsProviders';

export type ICompletionsGateway = Readonly<{
  completion(
    ctx: Context,
    provider: CompletionsProvider,
    request: StandardCompletionsRequest,
  ): Promise<Result<TextResponse, AppError>>;
  completionObject(
    ctx: Context,
    provider: CompletionsProvider,
    request: StructuredCompletionsRequest,
  ): Promise<Result<ObjectResponse, AppError>>;
  streamCompletion(
    ctx: Context,
    provider: CompletionsProvider,
    request: StandardCompletionsRequest,
  ): AsyncGenerator<Result<StreamPart, AppError>>;
  streamCompletionObject(
    ctx: Context,
    provider: CompletionsProvider,
    request: StructuredCompletionsRequest,
  ): AsyncGenerator<Result<ObjectStreamPart, AppError>>;
}>;
