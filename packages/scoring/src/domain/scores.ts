import zod from 'zod';
import { scoreIdSchema } from './ids.js';

// Score range: 300-850 (FICO-style)
export const MIN_SCORE = 300;
export const MAX_SCORE = 850;

// Component types
export const ScoreComponentType = zod.enum([
  'determinism',
  'brandAlignment',
  'grounding',
  'safety',
  'operationalEfficiency',
]);
export type ScoreComponentType = zod.infer<typeof ScoreComponentType>;

// Component weights (must sum to 100)
export const COMPONENT_WEIGHTS: Record<ScoreComponentType, number> = {
  determinism: 20,
  brandAlignment: 15,
  grounding: 30,
  safety: 25,
  operationalEfficiency: 10,
} as const;

// Evidence excerpt - a piece of conversation that drove the score
export const evidenceExcerptSchema = zod.object({
  type: zod.enum(['user', 'agent']),
  content: zod.string().min(1),
  timestamp: zod.string().datetime(),
  relevanceReason: zod.string().min(1),
});

export type EvidenceExcerpt = zod.infer<typeof evidenceExcerptSchema>;

// LLM-as-Judge reasoning output
export const judgeReasoningSchema = zod.object({
  reasoning: zod.string().min(1),
  score: zod.number().min(1).max(5),
  confidence: zod.number().min(0).max(1),
  evidence: zod.array(evidenceExcerptSchema).default([]),
});

export type JudgeReasoning = zod.infer<typeof judgeReasoningSchema>;

// Individual component score
export const componentScoreSchema = zod.object({
  type: ScoreComponentType,
  weight: zod.number().min(0).max(100),
  rawScore: zod.number().min(1).max(5), // 1-5 scale from LLM judge
  normalizedScore: zod.number().min(MIN_SCORE).max(MAX_SCORE), // 300-850
  weightedScore: zod.number().min(0), // rawScore * weight / 100
  reasoning: judgeReasoningSchema,
  passed: zod.boolean(),
});

export type ComponentScore = zod.infer<typeof componentScoreSchema>;

// Composite score
export const compositeScoreSchema = zod.object({
  id: scoreIdSchema,
  overallScore: zod.number().min(MIN_SCORE).max(MAX_SCORE),
  components: zod.array(componentScoreSchema),
  calculatedAt: zod.string().datetime(),
  schemaVersion: zod.literal('1.0.0'),
});

export type CompositeScore = zod.infer<typeof compositeScoreSchema>;

// Normalization helper: convert 1-5 score to 300-850 range
export function normalizeToFicoScale(rawScore: number): number {
  // Map 1-5 linearly to 300-850
  // 1 -> 300, 5 -> 850
  const normalized = MIN_SCORE + ((rawScore - 1) / 4) * (MAX_SCORE - MIN_SCORE);
  return Math.round(normalized);
}

// Calculate weighted score
export function calculateWeightedScore(
  rawScore: number,
  weight: number,
): number {
  return (rawScore * weight) / 100;
}
