import type { AgentManifest } from '@backend/agents/domain';
import type { AgentResult } from '@core/domain/agents';
import type { FinishReason, StepResult, Usage } from '@core/domain/ai';

/**
 * Builds the final AgentResult from completed steps.
 * Extracts text and output from steps, calculates total usage.
 */
export function buildAgentResult(
  manifest: AgentManifest,
  steps: StepResult[],
  finalFinishReason: FinishReason,
  outputValue?: unknown,
): AgentResult {
  // Extract final text from last step
  const lastStep = steps[steps.length - 1];
  const text = lastStep?.text;

  // Calculate total usage across all steps
  const totalUsage: Usage = steps.reduce(
    (acc, step) => ({
      inputTokens: acc.inputTokens + (step.usage?.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (step.usage?.outputTokens ?? 0),
      totalTokens: acc.totalTokens + (step.usage?.totalTokens ?? 0),
      cachedInputTokens:
        acc.cachedInputTokens + (step.usage?.cachedInputTokens ?? 0),
      reasoningTokens: acc.reasoningTokens + (step.usage?.reasoningTokens ?? 0),
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedInputTokens: 0,
      reasoningTokens: 0,
    },
  );

  return {
    status: 'complete',
    manifestId: manifest.config.id,
    provider: manifest.config.provider.provider,
    model: manifest.config.provider.model,
    text,
    output: outputValue,
    steps,
    totalUsage,
    finishReason: finalFinishReason,
  };
}
