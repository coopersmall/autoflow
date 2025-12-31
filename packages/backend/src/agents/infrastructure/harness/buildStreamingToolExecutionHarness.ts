import { createStreamingBaseToolExecutor } from './createStreamingBaseToolExecutor';
import {
  createStreamingToolExecutionHarness,
  type StreamingToolExecutionHarness,
} from './createStreamingToolExecutionHarness';

/**
 * Builds a streaming tool execution harness with the base executor.
 *
 * Note: Per-tool middleware is applied in buildAgentTools when wrapping
 * individual tool execute functions. The harness itself uses no middleware.
 *
 * @returns A streaming tool execution harness with base executor
 */
export function buildStreamingToolExecutionHarness(): StreamingToolExecutionHarness {
  return Object.freeze(
    createStreamingToolExecutionHarness(
      createStreamingBaseToolExecutor(),
      [], // No harness-level middleware - applied per-tool in buildAgentTools
    ),
  );
}
