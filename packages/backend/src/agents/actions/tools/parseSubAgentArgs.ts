import {
  type AgentRequest,
  AgentToolResult,
  defaultSubAgentArgsSchema,
} from '@core/domain/agents';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';

/**
 * Result type for sub-agent argument parsing.
 * Returns either a valid AgentRequest or an error AgentToolResult.
 */
export type ParseSubAgentArgsResult = Result<
  AgentRequest,
  ReturnType<typeof AgentToolResult.error>
>;

/**
 * Parses and validates sub-agent tool arguments.
 *
 * If a mapper function is provided, it's used to transform the input.
 * Otherwise, validates against the default schema (prompt + optional context).
 *
 * @param input - The raw input from the tool call
 * @param mapper - Optional mapper function to transform input to AgentRequest
 * @returns A Result containing either the AgentRequest or an error AgentToolResult
 */
export function parseSubAgentArgs(
  input: unknown,
  mapper: ((args: unknown) => AgentRequest) | undefined,
): ParseSubAgentArgsResult {
  if (mapper) {
    return ok(mapper(input));
  }

  // Validate args against default schema
  const argsResult = validate(defaultSubAgentArgsSchema, input);
  if (argsResult.isErr()) {
    return err(
      AgentToolResult.error(
        `Invalid sub-agent arguments: ${argsResult.error.message}`,
        'ValidationError',
      ),
    );
  }

  return ok({
    type: 'request',
    prompt: argsResult.value.prompt,
    context: argsResult.value.context,
  });
}
