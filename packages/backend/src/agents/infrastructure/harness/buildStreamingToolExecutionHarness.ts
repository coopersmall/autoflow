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
 * This is the entry point for creating a streaming harness.
 * Middleware can be added based on the manifest config in the future.
 */
export function buildStreamingToolExecutionHarness(
  _config: AgentManifestConfig, // For future middleware config
): StreamingToolExecutionHarness {
  // Start with no middleware - add as needed
  const middleware: StreamingToolExecutionMiddleware[] = [
    // Future: streamingLoggingMiddleware(config.toolExecution?.logging),
    // Future: streamingTimeoutMiddleware(config.toolExecution?.timeout),
  ];

  return createStreamingToolExecutionHarness(
    createStreamingBaseToolExecutor(),
    middleware,
  );
}
