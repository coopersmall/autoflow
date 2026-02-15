import type { AppError, Context } from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';
import {
  type ComponentScore,
  type JudgeReasoning,
  type ScoreComponentType,
  COMPONENT_WEIGHTS,
  calculateWeightedScore,
  componentScoreSchema,
  judgeReasoningSchema,
  normalizeToFicoScale,
} from '../domain/scores.js';

// Input for evaluating a single component
export const evaluationInputSchema = zod.object({
  componentType: zod.enum([
    'determinism',
    'brandAlignment',
    'grounding',
    'safety',
    'operationalEfficiency',
  ]),
  sessionData: zod.unknown(), // Will be typed more specifically when integrated
  context: zod.unknown(),
});

export type EvaluationInput = zod.infer<typeof evaluationInputSchema>;

// Context for evaluation
export interface EvaluationContext {
  logger: {
    info: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
  };
  correlationId: string;
  signal?: AbortSignal;
}

// LLM Judge response format
export const llmJudgeResponseSchema = zod.object({
  reasoning: zod.string(),
  score: zod.number().min(1).max(5),
  confidence: zod.number().min(0).max(1),
  evidence: zod
    .array(
      zod.object({
        type: zod.enum(['user', 'agent']),
        content: zod.string(),
        timestamp: zod.string(),
        relevanceReason: zod.string(),
      }),
    )
    .optional()
    .default([]),
});

export type LlmJudgeResponse = zod.infer<typeof llmJudgeResponseSchema>;

// Creates a component score from judge response
export function createComponentScore(
  type: ScoreComponentType,
  judgeResponse: LlmJudgeResponse,
  passThreshold: number = 3,
): Result<ComponentScore, AppError> {
  const weight = COMPONENT_WEIGHTS[type];
  const rawScore = judgeResponse.score;
  const normalizedScore = normalizeToFicoScale(rawScore);
  const weightedScore = calculateWeightedScore(rawScore, weight);
  const passed = rawScore >= passThreshold;

  const reasoning: JudgeReasoning = {
    reasoning: judgeResponse.reasoning,
    score: judgeResponse.score,
    confidence: judgeResponse.confidence,
    evidence: judgeResponse.evidence ?? [],
  };

  return ok({
    type,
    weight,
    rawScore,
    normalizedScore,
    weightedScore,
    reasoning,
    passed,
  });
}

// Helper to validate judge response
export function validateJudgeResponse(
  response: unknown,
): Result<LlmJudgeResponse, AppError> {
  const result = llmJudgeResponseSchema.safeParse(response);
  if (!result.success) {
    return err({
      type: 'bad_request',
      message: 'Invalid LLM judge response',
      metadata: { errors: result.error.errors },
    });
  }
  return ok(result.data);
}
