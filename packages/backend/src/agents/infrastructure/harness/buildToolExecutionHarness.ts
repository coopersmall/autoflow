import type {
  AgentManifestConfig,
  ToolExecutionMiddleware,
} from '@core/domain/agents';
import { createBaseToolExecutor } from './createBaseToolExecutor';
import type { ToolExecutionHarness } from './createToolExecutionHarness';
import { createToolExecutionHarness } from './createToolExecutionHarness';

export function buildToolExecutionHarness(
  _config: AgentManifestConfig,
): ToolExecutionHarness {
  const middleware: ToolExecutionMiddleware[] = [];
  return createToolExecutionHarness(createBaseToolExecutor(), middleware);
}
