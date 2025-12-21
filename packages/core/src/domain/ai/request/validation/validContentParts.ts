import type { AppError } from "@core/errors/AppError";
import { validate } from "@core/validation/validate";
import type { Result } from "neverthrow";
import {
  type RequestAssistantContentPart,
  type RequestToolContentPart,
  type RequestUserContentPart,
  requestAssistantContentPartSchema,
  requestToolContentPartSchema,
  requestUserContentPartSchema,
} from "../completions/content/ContentPart";
import {
  type RequestFilePart,
  requestFilePartSchema,
} from "../completions/content/FilePart";
import {
  type RequestImagePart,
  requestImagePartSchema,
} from "../completions/content/ImagePart";
import {
  type RequestReasoningPart,
  requestReasoningPartSchema,
} from "../completions/content/ReasoningPart";
import {
  type RequestTextPart,
  requestTextPartSchema,
} from "../completions/content/TextPart";
import {
  type RequestToolCallPart,
  requestToolCallPartSchema,
} from "../completions/content/ToolCallPart";
import {
  type RequestToolResultPart,
  requestToolResultPartSchema,
} from "../completions/content/ToolResultPart";

export function validRequestTextPart(
  input: unknown,
): Result<RequestTextPart, AppError> {
  return validate(requestTextPartSchema, input);
}

export function validRequestImagePart(
  input: unknown,
): Result<RequestImagePart, AppError> {
  return validate(requestImagePartSchema, input);
}

export function validRequestFilePart(
  input: unknown,
): Result<RequestFilePart, AppError> {
  return validate(requestFilePartSchema, input);
}

export function validRequestReasoningPart(
  input: unknown,
): Result<RequestReasoningPart, AppError> {
  return validate(requestReasoningPartSchema, input);
}

export function validRequestToolCallPart(
  input: unknown,
): Result<RequestToolCallPart, AppError> {
  return validate(requestToolCallPartSchema, input);
}

export function validRequestToolResultPart(
  input: unknown,
): Result<RequestToolResultPart, AppError> {
  return validate(requestToolResultPartSchema, input);
}

export function validRequestUserContentPart(
  input: unknown,
): Result<RequestUserContentPart, AppError> {
  return validate(requestUserContentPartSchema, input);
}

export function validRequestAssistantContentPart(
  input: unknown,
): Result<RequestAssistantContentPart, AppError> {
  return validate(requestAssistantContentPartSchema, input);
}

export function validRequestToolContentPart(
  input: unknown,
): Result<RequestToolContentPart, AppError> {
  return validate(requestToolContentPartSchema, input);
}
