import {
  type DataPart,
  dataPartSchemas,
  type FilePart,
  type FinishMessagePart,
  type FinishStepPart,
  filePartSchemas,
  finishMessagePartSchemas,
  finishStepPartSchemas,
  type MessageAnnotationPart,
  messageAnnotationPartSchemas,
  type ReasoningSignaturePart,
  type RedactedReasoningPart,
  reasoningSignaturePartSchemas,
  redactedReasoningPartSchemas,
  type SourcePart,
  type StartStepPart,
  type StreamPart,
  sourcePartSchemas,
  startStepPartSchemas,
  streamPartSchema,
  type ToolCallDeltaPart,
  type ToolCallPart,
  type ToolCallStreamingStartPart,
  type ToolResultPart,
  toolCallDeltaPartSchemas,
  toolCallPartSchemas,
  toolCallStreamingStartPartSchemas,
  toolResultPartSchemas,
} from '@core/domain/ai/streamingPart.ts';
import type { AppError } from '@core/errors/AppError.ts';
import { validate } from '@core/validation/validate.ts';
import type { Result } from 'neverthrow';
import zod from 'zod';

export function validStreamPart(input: unknown): Result<StreamPart, AppError> {
  return validate(streamPartSchema, input);
}

export function validRedactedReasoningPart(
  input: unknown,
): Result<RedactedReasoningPart, AppError> {
  return validate(redactedReasoningPartSchemas[0], input);
}

export function validReasoningSignaturePart(
  input: unknown,
): Result<ReasoningSignaturePart, AppError> {
  return validate(reasoningSignaturePartSchemas[0], input);
}

export function validSourcePart(input: unknown): Result<SourcePart, AppError> {
  return validate(sourcePartSchemas[0], input);
}

export function validFilePart(input: unknown): Result<FilePart, AppError> {
  return validate(filePartSchemas[0], input);
}

export function validDataPart(input: unknown): Result<DataPart, AppError> {
  return validate(dataPartSchemas[0], input);
}

export function validMessageAnnotationPart(
  input: unknown,
): Result<MessageAnnotationPart, AppError> {
  return validate(messageAnnotationPartSchemas[0], input);
}

export function validToolCallStreamingStartPart(
  input: unknown,
): Result<ToolCallStreamingStartPart, AppError> {
  return validate(toolCallStreamingStartPartSchemas[0], input);
}

export function validToolCallDeltaPart(
  input: unknown,
): Result<ToolCallDeltaPart, AppError> {
  return validate(toolCallDeltaPartSchemas[0], input);
}

export function validToolCallPart(
  input: unknown,
): Result<ToolCallPart, AppError> {
  return validate(toolCallPartSchemas[0], input);
}

export function validToolResultPart(
  input: unknown,
): Result<ToolResultPart, AppError> {
  return validate(toolResultPartSchemas[0], input);
}

export function validStartStepPart(
  input: unknown,
): Result<StartStepPart, AppError> {
  return validate(startStepPartSchemas[0], input);
}

export function validFinishStepPart(
  input: unknown,
): Result<FinishStepPart, AppError> {
  return validate(finishStepPartSchemas[0], input);
}

export function validFinishMessagePart(
  input: unknown,
): Result<FinishMessagePart, AppError> {
  return validate(finishMessagePartSchemas[0], input);
}

export function validStringContent(input: unknown): Result<string, AppError> {
  const stringSchema = zod.string();
  return validate(stringSchema, input);
}

export function validDataArray(
  input: unknown,
): Result<Array<unknown>, AppError> {
  const arraySchema = zod.array(zod.unknown());
  return validate(arraySchema, input);
}

export function validAnnotationsArray(
  input: unknown,
): Result<Array<unknown>, AppError> {
  const arraySchema = zod.array(zod.unknown());
  return validate(arraySchema, input);
}
