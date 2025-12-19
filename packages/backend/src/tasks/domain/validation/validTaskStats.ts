import {
  type TaskStats,
  taskStatsSchema,
} from '@backend/tasks/domain/TaskStats';
import type { AppError } from '@core/errors';

import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validTaskStats(input: unknown): Result<TaskStats, AppError> {
  return validate(taskStatsSchema, input);
}
