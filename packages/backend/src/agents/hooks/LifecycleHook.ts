import type { Context } from '@backend/infrastructure/context';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

/**
 * A lifecycle hook function signature.
 * All lifecycle hooks return Result for explicit error handling.
 * Errors propagate to caller and can abort the run.
 */
export type LifecycleHook<TParams> = (
  ctx: Context,
  params: TParams,
) => Promise<Result<void, AppError>>;
