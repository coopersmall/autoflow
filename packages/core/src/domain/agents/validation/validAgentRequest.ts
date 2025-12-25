import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import type { AgentRequest } from '../execution/AgentRequest';
import { agentRequestSchema } from '../execution/AgentRequest';

export function validAgentRequest(
  input: unknown,
): Result<AgentRequest, AppError> {
  return validate(agentRequestSchema, input);
}
