import type { Context } from '@backend/infrastructure/context';
import type { Message, StepResult, ToolChoice } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

/**
 * Options passed to onStepStart hook.
 */
export interface OnStepStartOptions {
  readonly stepNumber: number;
  readonly steps: readonly StepResult[];
  readonly messages: readonly Message[];
  readonly provider: string;
  readonly model: string;
}

/**
 * Result from onStepStart hook - can modify step behavior.
 */
export interface OnStepStartResult {
  readonly messages?: readonly Message[];
  readonly toolChoice?: ToolChoice;
  readonly activeTools?: readonly string[];
}

/**
 * Function called before each LLM step.
 * Can modify messages, toolChoice, activeTools.
 * Returns Result - errors abort the run.
 */
export type OnStepStartFunction = (
  ctx: Context,
  options: OnStepStartOptions,
) => Promise<Result<OnStepStartResult, AppError>>;

/**
 * Function called after each step completes.
 * Returns Result - errors abort the run.
 */
export type OnStepFinishFunction = (
  ctx: Context,
  result: StepResult,
) => Promise<Result<void, AppError>>;

/**
 * Step transformation hooks - can modify agent behavior during execution.
 *
 * These hooks are composed using composeStepStart/buildChain strategies
 * because they have different semantics than lifecycle hooks:
 * - onStepStart: Can transform messages, toolChoice, activeTools (compose pattern)
 * - onStepFinish: Called after step completes (chain pattern, takes ctx)
 */
export interface StepTransformationHooks {
  /**
   * Called before each LLM step. Can modify messages, toolChoice, activeTools.
   * Returns Result - errors abort the run.
   */
  onStepStart?: OnStepStartFunction;

  /**
   * Called after each step completes. Receives the step result.
   * Returns Result - errors abort the run.
   */
  onStepFinish?: OnStepFinishFunction;
}
