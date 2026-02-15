import type { AppError } from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import { ScoreId } from '../domain/ids.js';
import {
  type ComponentScore,
  type CompositeScore,
  MAX_SCORE,
  MIN_SCORE,
  COMPONENT_WEIGHTS,
} from '../domain/scores.js';

// Input for calculating composite score
export interface CalculateCompositeInput {
  components: ComponentScore[];
}

// Calculates the composite score from component scores
export function calculateCompositeScore(
  input: CalculateCompositeInput,
): Result<CompositeScore, AppError> {
  // Validate we have all required components
  const requiredTypes = Object.keys(COMPONENT_WEIGHTS) as Array<
    keyof typeof COMPONENT_WEIGHTS
  >;
  const providedTypes = new Set(input.components.map((c) => c.type));

  const missingTypes = requiredTypes.filter((t) => !providedTypes.has(t));
  if (missingTypes.length > 0) {
    return err({
      type: 'bad_request',
      message: 'Missing required component scores',
      metadata: { missingComponents: missingTypes },
    });
  }

  // Validate weights sum to 100
  const totalWeight = input.components.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight !== 100) {
    return err({
      type: 'bad_request',
      message: `Component weights must sum to 100, got ${totalWeight}`,
    });
  }

  // Calculate weighted average of normalized scores
  // Actually, we should use the raw scores with weights, then normalize
  const weightedRawSum = input.components.reduce(
    (sum, c) => sum + c.rawScore * (c.weight / 100),
    0,
  );

  // Map weighted raw average (1-5) to FICO scale (300-850)
  const overallScore = Math.round(
    MIN_SCORE + ((weightedRawSum - 1) / 4) * (MAX_SCORE - MIN_SCORE),
  );

  // Ensure score is within bounds
  const clampedScore = Math.max(MIN_SCORE, Math.min(MAX_SCORE, overallScore));

  const composite: CompositeScore = {
    id: ScoreId(),
    overallScore: clampedScore,
    components: input.components,
    calculatedAt: new Date().toISOString(),
    schemaVersion: '1.0.0',
  };

  return ok(composite);
}
