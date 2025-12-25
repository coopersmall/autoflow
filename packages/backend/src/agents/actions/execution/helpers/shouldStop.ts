import type { AgentManifest } from '@core/domain/agents';
import type { FinishReason, StepResult } from '@core/domain/ai';

type ShouldStopParams = {
  readonly manifest: AgentManifest;
  readonly finishReason: FinishReason;
  readonly steps: StepResult[];
  readonly currentStepNumber: number;
};

/**
 * Determines if the agent loop should stop based on stopWhen conditions.
 * Reuses existing StopWhen logic from completions.
 */
export function shouldStop(params: ShouldStopParams): boolean {
  const { manifest, finishReason, steps, currentStepNumber } = params;

  const stopWhen = manifest.config.stopWhen;
  if (!stopWhen || stopWhen.length === 0) {
    // Default: stop after 20 steps
    return currentStepNumber >= 20;
  }

  for (const condition of stopWhen) {
    switch (condition.type) {
      case 'stepCount':
        if (currentStepNumber >= condition.stepCount) {
          return true;
        }
        break;

      case 'toolUse': {
        // Check if the condition tool was used in any step
        const toolUsed = steps.some((step) =>
          step.toolCalls?.some((call) => call.toolName === condition.name),
        );
        if (toolUsed) {
          return true;
        }
        break;
      }
    }
  }

  const stopOnText =
    manifest.config.onTextOnly && manifest.config.onTextOnly === 'stop';

  // Stop if the manifest is configured to stop on text and the finish reason is 'stop'
  return finishReason === 'stop' && stopOnText;
}
