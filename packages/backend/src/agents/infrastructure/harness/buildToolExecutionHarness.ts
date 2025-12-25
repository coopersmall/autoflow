import type {
  AgentManifestConfig,
  ToolExecutionMiddleware,
} from '@core/domain/agents';
import { createBaseToolExecutor } from './createBaseToolExecutor';
import type { ToolExecutionHarness } from './createToolExecutionHarness';
import { createToolExecutionHarness } from './createToolExecutionHarness';

export function buildToolExecutionHarness(
  _config: AgentManifestConfig, // For future middleware config
): ToolExecutionHarness {
  // Start with no middleware - add as needed
  const middleware: ToolExecutionMiddleware[] = [
    // Future: loggingMiddleware(config.toolExecution?.logging),
    // Future: timeoutMiddleware(config.toolExecution?.timeout),
    // Future: retryMiddleware(config.toolExecution?.retry),
  ];

  return createToolExecutionHarness(createBaseToolExecutor(), middleware);
}
