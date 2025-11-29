import {
  type TaskStats,
  taskStatsSchema,
} from '@backend/tasks/domain/TaskStats';
import type { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validTaskStats(
  input: unknown,
): Result<TaskStats, ValidationError> {
  return validate(taskStatsSchema, input);
}
