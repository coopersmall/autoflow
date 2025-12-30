import type {
  AgentManifestConfig,
  StreamingToolExecutionMiddleware,
} from '@core/domain/agents';
import { createStreamingBaseToolExecutor } from './createStreamingBaseToolExecutor';
import {
  createStreamingToolExecutionHarness,
  type StreamingToolExecutionHarness,
} from './createStreamingToolExecutionHarness';

/**
 * Builds a streaming tool execution harness from the manifest config.
 *
 * TODO: Implement middleware configuration from manifest.config.toolMiddleware.
 * Currently returns an empty middleware array as middleware is not yet configurable.
 *
 * @param _config - Reserved for future middleware configuration
 * @returns A streaming tool execution harness with base executor
 */
export function buildStreamingToolExecutionHarness(
  _config: AgentManifestConfig,
): StreamingToolExecutionHarness {
  const middleware: StreamingToolExecutionMiddleware[] = [];
  return createStreamingToolExecutionHarness(
    createStreamingBaseToolExecutor(),
    middleware,
  );
}
