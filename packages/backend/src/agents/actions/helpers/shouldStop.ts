import type { StepResult, StopWhen } from '@core/domain/ai';

/**
 * Determines if the agent loop should stop based on stopWhen conditions.
 * Reuses existing StopWhen logic from completions.
 */
export function shouldStop(
  stopWhen: StopWhen[] | undefined,
  steps: StepResult[],
  currentStepNumber: number,
): boolean {
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

  return false;
}
