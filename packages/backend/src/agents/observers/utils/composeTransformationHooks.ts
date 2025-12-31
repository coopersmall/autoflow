import type { Context } from '@backend/infrastructure/context';
import type { AppError } from '@core/errors/AppError';
import { ok, type Result } from 'neverthrow';
import type {
  OnStepStartFunction,
  OnStepStartOptions,
  OnStepStartResult,
} from '../../hooks/StepTransformationHooks';

/**
 * Composes multiple onStepStart functions into one.
 * Each handler can transform messages, toolChoice, and activeTools.
 * Results are merged - later handlers can override earlier ones.
 * Each handler receives the transformed messages from previous handlers.
 *
 * ORDERING: Observers are called first (in registration order), then the manifest hook (base).
 *
 * Used for transformation hooks where each handler can modify state.
 *
 * Errors propagate immediately (no swallowing).
 */
export function composeTransformationHooks(
  handlers: (OnStepStartFunction | undefined)[],
  base: OnStepStartFunction | undefined,
): OnStepStartFunction | undefined {
  const defined = [
    ...handlers.filter((h): h is OnStepStartFunction => h !== undefined),
    base,
  ].filter((h): h is OnStepStartFunction => h !== undefined);

  if (defined.length === 0) return undefined;
  if (defined.length === 1) return defined[0];

  return async (
    ctx: Context,
    options: OnStepStartOptions,
  ): Promise<Result<OnStepStartResult, AppError>> => {
    let currentOptions = options;
    let result: OnStepStartResult = {};

    for (const handler of defined) {
      const stepResult = await handler(ctx, currentOptions);

      // Propagate errors immediately
      if (stepResult.isErr()) {
        return stepResult;
      }

      const value = stepResult.value;
      if (value) {
        // Merge results - later handlers override earlier
        result = {
          messages: value.messages ?? result.messages,
          toolChoice: value.toolChoice ?? result.toolChoice,
          activeTools: value.activeTools ?? result.activeTools,
        };

        // Update options with transformed messages for next handler
        if (value.messages) {
          currentOptions = { ...currentOptions, messages: value.messages };
        }
      }
    }

    return ok(result);
  };
}
