import type { OutputToolConfig } from '@core/domain/agents';
import type { ToolCall } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import Ajv from 'ajv';
import { err, ok, type Result } from 'neverthrow';

// Singleton Ajv instance for efficiency
const ajv = new Ajv();

export interface OutputValidationContext {
  readonly outputToolCall: ToolCall;
  readonly outputToolConfig: OutputToolConfig;
  readonly currentRetries: number;
}

export type OutputValidationResult =
  | { status: 'valid' }
  | { status: 'invalid'; errorMessage: string }
  | { status: 'max_retries_exceeded' };

/**
 * Validates the output tool call against its JSON Schema.
 * Returns validation status to let the caller decide how to handle it.
 */
export function validateOutputToolResult(
  context: OutputValidationContext,
): Result<OutputValidationResult, AppError> {
  const { outputToolCall, outputToolConfig, currentRetries } = context;

  const validationConfig = outputToolConfig.validation;
  const maxRetries = validationConfig?.maxRetries ?? 3;
  const shouldRetry = validationConfig?.retryOnFailure ?? true;

  // Check max retries first
  if (currentRetries >= maxRetries) {
    return ok({ status: 'max_retries_exceeded' });
  }

  // Compile and validate schema
  const schema = outputToolConfig.tool.function.parameters;
  const validate = ajv.compile(schema);
  const valid = validate(outputToolCall.input);

  if (valid) {
    return ok({ status: 'valid' });
  }

  // Validation failed
  if (!shouldRetry) {
    return err(
      internalError('Output validation failed and retries disabled', {
        metadata: { errors: validate.errors },
      }),
    );
  }

  const errorMessage = `The output you provided is invalid according to the expected schema. Please correct the output and try again. Validation errors: ${JSON.stringify(validate.errors)}`;

  return ok({ status: 'invalid', errorMessage });
}
