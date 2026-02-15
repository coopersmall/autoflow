import type { AppError } from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';
import {
  createComponentScore,
  type EvaluationContext,
  type LlmJudgeResponse,
} from './evaluateComponent.js';

// Operational efficiency evaluation input
export const operationalEfficiencyInputSchema = zod.object({
  sessions: zod.array(
    zod.object({
      turnCount: zod.number().int().min(1),
      durationMs: zod.number().int().min(0),
      resolvedIssue: zod.boolean(),
      userSatisfied: zod.boolean().optional(),
    }),
  ),
  benchmarkTurnCount: zod.number().int().min(1).default(3),
  benchmarkDurationMs: zod.number().int().min(0).default(60000),
});

export type OperationalEfficiencyInput = zod.infer<
  typeof operationalEfficiencyInputSchema
>;

// Evaluates operational efficiency
export function evaluateOperationalEfficiency(
  input: OperationalEfficiencyInput,
  ctx: EvaluationContext,
): Result<ComponentScore, AppError> {
  // Parse input to apply schema defaults
  const parseResult = operationalEfficiencyInputSchema.safeParse(input);
  if (!parseResult.success) {
    return err({
      type: 'bad_request',
      message: `Invalid input: ${parseResult.error.message}`,
    });
  }
  const parsedInput = parseResult.data;

  ctx.logger.info('Evaluating operational efficiency component', {
    sessionCount: parsedInput.sessions.length,
  });

  // Calculate metrics
  const avgTurnCount =
    parsedInput.sessions.reduce((sum, s) => sum + s.turnCount, 0) /
    parsedInput.sessions.length;
  const avgDurationMs =
    parsedInput.sessions.reduce((sum, s) => sum + s.durationMs, 0) /
    parsedInput.sessions.length;
  const resolutionRate =
    parsedInput.sessions.filter((s) => s.resolvedIssue).length /
    parsedInput.sessions.length;

  // Compare to benchmarks
  const turnScore =
    avgTurnCount <= parsedInput.benchmarkTurnCount
      ? 5
      : Math.max(1, 5 - (avgTurnCount - parsedInput.benchmarkTurnCount));
  const durationScore =
    avgDurationMs <= parsedInput.benchmarkDurationMs
      ? 5
      : Math.max(
          1,
          5 - (avgDurationMs - parsedInput.benchmarkDurationMs) / 60000,
        );
  const resolutionScore = Math.round(resolutionRate * 4) + 1;

  // Weighted average of metrics
  const score = Math.round(
    turnScore * 0.3 + durationScore * 0.3 + resolutionScore * 0.4,
  );

  const evidence: Array<{
    type: 'user' | 'agent';
    content: string;
    timestamp: string;
    relevanceReason: string;
  }> = [
    {
      type: 'agent',
      content: `Average turns: ${avgTurnCount.toFixed(1)} (benchmark: ${parsedInput.benchmarkTurnCount})`,
      timestamp: new Date().toISOString(),
      relevanceReason: 'Turn efficiency metric',
    },
    {
      type: 'agent',
      content: `Average duration: ${(avgDurationMs / 1000).toFixed(1)}s (benchmark: ${parsedInput.benchmarkDurationMs / 1000}s)`,
      timestamp: new Date().toISOString(),
      relevanceReason: 'Time efficiency metric',
    },
    {
      type: 'agent',
      content: `resolution rate: ${(resolutionRate * 100).toFixed(1)}%`,
      timestamp: new Date().toISOString(),
      relevanceReason: 'Issue resolution metric',
    },
  ];

  const judge: LlmJudgeResponse = {
    reasoning: `Efficiency metrics: ${(avgTurnCount / parsedInput.benchmarkTurnCount * 100).toFixed(0)}% of benchmark turns, ${(avgDurationMs / parsedInput.benchmarkDurationMs * 100).toFixed(0)}% of benchmark duration, ${(resolutionRate * 100).toFixed(0)}% resolution rate.`,
    score: Math.max(1, Math.min(5, score)),
    confidence: 0.85,
    evidence,
  };

  return createComponentScore('operationalEfficiency', judge);
}
