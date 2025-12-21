import type { AppError } from "@core/errors/AppError";
import { validate } from "@core/validation/validate";
import type { Result } from "neverthrow";
import {
  type CompletionsRequest,
  type StandardCompletionsRequest,
  type StructuredCompletionsRequest,
  completionsRequestSchema,
  standardCompletionsRequestSchema,
  structuredCompletionsRequestSchema,
} from "../completions";
import {
  type ResponseFormat,
  responseFormatSchema,
} from "../completions/format/ResponseFormat";
import {
  type ResponseFormatJson,
  responseFormatJsonSchema,
} from "../completions/format/ResponseFormatJson";
import {
  type ResponseFormatJsonSchema,
  responseFormatJsonSchemaSchema,
} from "../completions/format/ResponseFormatJsonSchema";
import {
  type ResponseFormatText,
  responseFormatTextSchema,
} from "../completions/format/ResponseFormatText";
import { type Message, messageSchema } from "../completions/messages/Message";
import {
  type AssistantMessage,
  assistantMessageSchema,
} from "../completions/messages/AssistantMessage";
import {
  type SystemMessage,
  systemMessageSchema,
} from "../completions/messages/SystemMessage";
import {
  type ToolMessage,
  toolMessageSchema,
} from "../completions/messages/ToolMessage";
import {
  type UserMessage,
  userMessageSchema,
} from "../completions/messages/UserMessage";
import {
  type GenerationLimits,
  generationLimitsSchema,
} from "../completions/shared/GenerationLimits";
import {
  type SamplingParameters,
  samplingParametersSchema,
} from "../completions/shared/SamplingParameters";
import {
  type Temperature,
  temperatureSchema,
} from "../completions/shared/Temperature";
import { type Tool, toolSchema } from "../completions/tools/Tool";
import {
  type ToolChoice,
  toolChoiceSchema,
} from "../completions/tools/ToolChoice";
import {
  type EmbeddingRequest,
  type EmbeddingsRequest,
  embeddingRequestSchema,
  embeddingsRequestSchema,
} from "../embeddings";

// Completions Request
export function validCompletionsRequest(
  input: unknown,
): Result<CompletionsRequest, AppError> {
  return validate(completionsRequestSchema, input);
}

export function validStandardCompletionsRequest(
  input: unknown,
): Result<StandardCompletionsRequest, AppError> {
  return validate(standardCompletionsRequestSchema, input);
}

export function validStructuredCompletionsRequest(
  input: unknown,
): Result<StructuredCompletionsRequest, AppError> {
  return validate(structuredCompletionsRequestSchema, input);
}

// Messages
export function validMessage(input: unknown): Result<Message, AppError> {
  return validate(messageSchema, input);
}

export function validSystemMessage(
  input: unknown,
): Result<SystemMessage, AppError> {
  return validate(systemMessageSchema, input);
}

export function validUserMessage(
  input: unknown,
): Result<UserMessage, AppError> {
  return validate(userMessageSchema, input);
}

export function validAssistantMessage(
  input: unknown,
): Result<AssistantMessage, AppError> {
  return validate(assistantMessageSchema, input);
}

export function validToolMessage(
  input: unknown,
): Result<ToolMessage, AppError> {
  return validate(toolMessageSchema, input);
}

// Response Formats
export function validResponseFormat(
  input: unknown,
): Result<ResponseFormat, AppError> {
  return validate(responseFormatSchema, input);
}

export function validResponseFormatText(
  input: unknown,
): Result<ResponseFormatText, AppError> {
  return validate(responseFormatTextSchema, input);
}

export function validResponseFormatJson(
  input: unknown,
): Result<ResponseFormatJson, AppError> {
  return validate(responseFormatJsonSchema, input);
}

export function validResponseFormatJsonSchema(
  input: unknown,
): Result<ResponseFormatJsonSchema, AppError> {
  return validate(responseFormatJsonSchemaSchema, input);
}

// Tools
export function validTool(input: unknown): Result<Tool, AppError> {
  return validate(toolSchema, input);
}

export function validToolChoice(input: unknown): Result<ToolChoice, AppError> {
  return validate(toolChoiceSchema, input);
}

// Shared Parameters
export function validTemperature(
  input: unknown,
): Result<Temperature, AppError> {
  return validate(temperatureSchema, input);
}

export function validSamplingParameters(
  input: unknown,
): Result<SamplingParameters, AppError> {
  return validate(samplingParametersSchema, input);
}

export function validGenerationLimits(
  input: unknown,
): Result<GenerationLimits, AppError> {
  return validate(generationLimitsSchema, input);
}

// Embeddings
export function validEmbeddingRequest(
  input: unknown,
): Result<EmbeddingRequest, AppError> {
  return validate(embeddingRequestSchema, input);
}

export function validEmbeddingsRequest(
  input: unknown,
): Result<EmbeddingsRequest, AppError> {
  return validate(embeddingsRequestSchema, input);
}
