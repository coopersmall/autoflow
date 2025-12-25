import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import type { AgentRunConfig } from '../execution/AgentRunConfig';
import { agentRunConfigSchema } from '../execution/AgentRunConfig';

export function validAgentRunConfig(
  input: unknown,
): Result<AgentRunConfig, AppError> {
  return validate(agentRunConfigSchema, input);
}
