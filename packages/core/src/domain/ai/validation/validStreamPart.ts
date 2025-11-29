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
} from '@core/domain/ai/streamingPart';
import type { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import zod from 'zod';

export function validStreamPart(
  input: unknown,
): Result<StreamPart, ValidationError> {
  return validate(streamPartSchema, input);
}

export function validRedactedReasoningPart(
  input: unknown,
): Result<RedactedReasoningPart, ValidationError> {
  return validate(redactedReasoningPartSchemas[0], input);
}

export function validReasoningSignaturePart(
  input: unknown,
): Result<ReasoningSignaturePart, ValidationError> {
  return validate(reasoningSignaturePartSchemas[0], input);
}

export function validSourcePart(
  input: unknown,
): Result<SourcePart, ValidationError> {
  return validate(sourcePartSchemas[0], input);
}

export function validFilePart(
  input: unknown,
): Result<FilePart, ValidationError> {
  return validate(filePartSchemas[0], input);
}

export function validDataPart(
  input: unknown,
): Result<DataPart, ValidationError> {
  return validate(dataPartSchemas[0], input);
}

export function validMessageAnnotationPart(
  input: unknown,
): Result<MessageAnnotationPart, ValidationError> {
  return validate(messageAnnotationPartSchemas[0], input);
}

export function validToolCallStreamingStartPart(
  input: unknown,
): Result<ToolCallStreamingStartPart, ValidationError> {
  return validate(toolCallStreamingStartPartSchemas[0], input);
}

export function validToolCallDeltaPart(
  input: unknown,
): Result<ToolCallDeltaPart, ValidationError> {
  return validate(toolCallDeltaPartSchemas[0], input);
}

export function validToolCallPart(
  input: unknown,
): Result<ToolCallPart, ValidationError> {
  return validate(toolCallPartSchemas[0], input);
}

export function validToolResultPart(
  input: unknown,
): Result<ToolResultPart, ValidationError> {
  return validate(toolResultPartSchemas[0], input);
}

export function validStartStepPart(
  input: unknown,
): Result<StartStepPart, ValidationError> {
  return validate(startStepPartSchemas[0], input);
}

export function validFinishStepPart(
  input: unknown,
): Result<FinishStepPart, ValidationError> {
  return validate(finishStepPartSchemas[0], input);
}

export function validFinishMessagePart(
  input: unknown,
): Result<FinishMessagePart, ValidationError> {
  return validate(finishMessagePartSchemas[0], input);
}

export function validStringContent(
  input: unknown,
): Result<string, ValidationError> {
  const stringSchema = zod.string();
  return validate(stringSchema, input);
}

export function validDataArray(
  input: unknown,
): Result<Array<unknown>, ValidationError> {
  const arraySchema = zod.array(zod.unknown());
  return validate(arraySchema, input);
}

export function validAnnotationsArray(
  input: unknown,
): Result<Array<unknown>, ValidationError> {
  const arraySchema = zod.array(zod.unknown());
  return validate(arraySchema, input);
}
