import type { AppError } from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';
import {
  createComponentScore,
  type EvaluationContext,
  type LlmJudgeResponse,
} from './evaluateComponent.js';

// Determinism evaluation input
export const determinismInputSchema = zod.object({
  responses: zod.array(
    zod.object({
      prompt: zod.string(),
      responses: zod.array(zod.string()).min(2),
    }),
  ),
});

export type DeterminismInput = zod.infer<typeof determinismInputSchema>;

// Calculate variance between responses (0 = identical, 1 = completely different)
function calculateResponseVariance(responses: string[]): number {
  if (responses.length < 2) return 0;

  // Simple word-level Jaccard similarity
  const wordSets = responses.map((r) => new Set(r.toLowerCase().split(/\s+/)));
  let totalSimilarity = 0;
  let comparisons = 0;

  for (let i = 0; i < wordSets.length; i++) {
    for (let j = i + 1; j < wordSets.length; j++) {
      const intersection = new Set(
        [...wordSets[i]].filter((x) => wordSets[j].has(x)),
      );
      const union = new Set([...wordSets[i], ...wordSets[j]]);
      totalSimilarity += intersection.size / union.size;
      comparisons++;
    }
  }

  return comparisons > 0 ? 1 - totalSimilarity / comparisons : 0;
}

// Evaluates determinism based on response variance
export function evaluateDeterminism(
  input: DeterminismInput,
  ctx: EvaluationContext,
  judgeResponse?: LlmJudgeResponse,
): Result<ComponentScore, AppError> {
  ctx.logger.info('Evaluating determinism component', {
    promptCount: input.responses.length,
  });

  // Calculate average variance across all prompts
  const variances = input.responses.map((r) =>
    calculateResponseVariance(r.responses),
  );
  const avgVariance =
    variances.reduce((a, b) => a + b, 0) / variances.length;

  ctx.logger.info('Calculated response variance', { avgVariance });

  // If judge response provided, use it; otherwise compute from variance
  let judge: LlmJudgeResponse;
  if (judgeResponse) {
    judge = judgeResponse;
  } else {
    // Map variance to 1-5 score (low variance = high score)
    // variance 0 -> score 5, variance 1 -> score 1
    const score = Math.round(5 - avgVariance * 4);
    judge = {
      reasoning: `Average response variance: ${(avgVariance * 100).toFixed(1)}%. Lower variance indicates more deterministic responses.`,
      score: Math.max(1, Math.min(5, score)),
      confidence: 0.8,
      evidence: [],
    };
  }

  return createComponentScore('determinism', judge);
}
