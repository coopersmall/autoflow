import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import {
  type ObjectResponse,
  objectResponseSchema,
} from '../completions/result/ObjectResponse';
import {
  type StepResult,
  stepResultSchema,
} from '../completions/result/StepResult';
import {
  type TextResponse,
  textResponseSchema,
} from '../completions/result/TextResponse';
import {
  type FinishReason,
  finishReasonSchema,
} from '../completions/shared/FinishReason';
import {
  type GeneratedFile,
  generatedFileSchema,
} from '../completions/shared/GeneratedFile';
import {
  type ProviderMetadata,
  providerMetadataSchema,
} from '../completions/shared/ProviderMetadata';
import {
  type ReasoningOutput,
  reasoningOutputSchema,
} from '../completions/shared/Reasoning';
import {
  type RequestMetadata,
  requestMetadataSchema,
} from '../completions/shared/RequestMetadata';
import {
  type ResponseMetadata,
  responseMetadataSchema,
} from '../completions/shared/ResponseMetadata';
import { type Source, sourceSchema } from '../completions/shared/Source';
import { type ToolCall, toolCallSchema } from '../completions/shared/ToolCall';
import {
  type ToolResult,
  toolResultSchema,
} from '../completions/shared/ToolResult';
import { type Usage, usageSchema } from '../completions/shared/Usage';
import { type Warning, warningSchema } from '../completions/shared/Warning';
import {
  type ObjectStreamPart,
  objectStreamPartSchema,
} from '../completions/streaming/ObjectStreamPart';
import {
  type StreamPart,
  streamPartSchema,
} from '../completions/streaming/StreamPart';
import {
  type EmbeddingResponse,
  type EmbeddingsResponse,
  embeddingResponseSchema,
  embeddingsResponseSchema,
} from '../embeddings';

// Final Results
export function validTextResponse(
  input: unknown,
): Result<TextResponse, AppError> {
  return validate(textResponseSchema, input);
}

export function validObjectResponse(
  input: unknown,
): Result<ObjectResponse, AppError> {
  return validate(objectResponseSchema, input);
}

export function validStepResult(input: unknown): Result<StepResult, AppError> {
  return validate(stepResultSchema, input);
}

// Shared Types
export function validFinishReason(
  input: unknown,
): Result<FinishReason, AppError> {
  return validate(finishReasonSchema, input);
}

export function validUsage(input: unknown): Result<Usage, AppError> {
  return validate(usageSchema, input);
}

export function validGeneratedFile(
  input: unknown,
): Result<GeneratedFile, AppError> {
  return validate(generatedFileSchema, input);
}

export function validProviderMetadata(
  input: unknown,
): Result<ProviderMetadata, AppError> {
  return validate(providerMetadataSchema, input);
}

export function validReasoningOutput(
  input: unknown,
): Result<ReasoningOutput, AppError> {
  return validate(reasoningOutputSchema, input);
}

export function validRequestMetadata(
  input: unknown,
): Result<RequestMetadata, AppError> {
  return validate(requestMetadataSchema, input);
}

export function validResponseMetadata(
  input: unknown,
): Result<ResponseMetadata, AppError> {
  return validate(responseMetadataSchema, input);
}

export function validSource(input: unknown): Result<Source, AppError> {
  return validate(sourceSchema, input);
}

export function validToolCall(input: unknown): Result<ToolCall, AppError> {
  return validate(toolCallSchema, input);
}

export function validToolResult(input: unknown): Result<ToolResult, AppError> {
  return validate(toolResultSchema, input);
}

export function validWarning(input: unknown): Result<Warning, AppError> {
  return validate(warningSchema, input);
}

// Streaming
export function validStreamPart(input: unknown): Result<StreamPart, AppError> {
  return validate(streamPartSchema, input);
}

export function validObjectStreamPart(
  input: unknown,
): Result<ObjectStreamPart, AppError> {
  return validate(objectStreamPartSchema, input);
}

// Embeddings
export function validEmbeddingResponse(
  input: unknown,
): Result<EmbeddingResponse, AppError> {
  return validate(embeddingResponseSchema, input);
}

export function validEmbeddingsResponse(
  input: unknown,
): Result<EmbeddingsResponse, AppError> {
  return validate(embeddingsResponseSchema, input);
}
