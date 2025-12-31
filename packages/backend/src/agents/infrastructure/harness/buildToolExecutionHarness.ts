import { createBaseToolExecutor } from './createBaseToolExecutor';
import type { ToolExecutionHarness } from './createToolExecutionHarness';
import { createToolExecutionHarness } from './createToolExecutionHarness';

/**
 * Builds a tool execution harness with the base executor.
 *
 * Note: Per-tool middleware is applied in buildAgentTools when wrapping
 * individual tool execute functions. The harness itself uses no middleware.
 *
 * @returns A tool execution harness with base executor
 */
export function buildToolExecutionHarness(): ToolExecutionHarness {
  return Object.freeze(
    createToolExecutionHarness(
      createBaseToolExecutor(),
      [], // No harness-level middleware - applied per-tool in buildAgentTools
    ),
  );
}
