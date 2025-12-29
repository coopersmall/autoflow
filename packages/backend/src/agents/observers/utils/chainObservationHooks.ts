import type { Context } from '@backend/infrastructure/context';
import type { AppError } from '@core/errors/AppError';
import { ok, type Result } from 'neverthrow';

type HookFn<TParams> = (
  ctx: Context,
  params: TParams,
) => Promise<Result<void, AppError>>;

/**
 * Creates a chained hook from multiple hook functions.
 * Calls each in sequence, stops on first error.
 *
 * ORDERING: Observers are called first (in registration order), then the manifest hook.
 *
 * Used for lifecycle and observation hooks where errors should abort the chain.
 */
export function chainObservationHooks<TParams>(
  handlers: (HookFn<TParams> | undefined)[],
  base: HookFn<TParams> | undefined,
): HookFn<TParams> | undefined {
  const defined = [
    ...handlers.filter((h): h is HookFn<TParams> => h !== undefined),
    base,
  ].filter((h): h is HookFn<TParams> => h !== undefined);

  if (defined.length === 0) return undefined;
  if (defined.length === 1) return defined[0];

  return async (ctx, params) => {
    for (const hook of defined) {
      const result = await hook(ctx, params);
      if (result.isErr()) return result;
    }
    return ok(undefined);
  };
}
