import type { AppError } from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';
import {
  createComponentScore,
  type EvaluationContext,
  type LlmJudgeResponse,
} from './evaluateComponent.js';

// Brand alignment evaluation input
export const brandAlignmentInputSchema = zod.object({
  brandVoice: zod.string().min(1),
  toneDescriptors: zod.array(
    zod.object({
      trait: zod.string().min(1),
      patterns: zod.array(zod.string()),
    }),
  ),
  agentResponses: zod.array(zod.string()).min(1),
});

export type BrandAlignmentInput = zod.infer<typeof brandAlignmentInputSchema>;

// Evaluates brand alignment using LLM-as-Judge
export function evaluateBrandAlignment(
  input: BrandAlignmentInput,
  ctx: EvaluationContext,
  judgeResponse: LlmJudgeResponse,
): Result<ComponentScore, AppError> {
  ctx.logger.info('Evaluating brand alignment component', {
    responseCount: input.agentResponses.length,
  });

  return createComponentScore('brandAlignment', judgeResponse);
}

// Prompt template for brand alignment LLM judge
export const BRAND_ALIGNMENT_JUDGE_PROMPT = `You are evaluating an AI agent's responses for brand alignment.

Brand Voice: {{brandVoice}}
Expected Tone Traits: {{toneTraits}}

Agent Responses:
{{responses}}

Score the agent's brand alignment on a scale of 1-5:
- 5: Perfectly embodies the brand voice and tone traits
- 4: Strong alignment with minor deviations
- 3: Acceptable alignment but room for improvement
- 2: Weak alignment, notable deviations
- 1: Poor alignment, does not match brand voice

Provide your reasoning, score, and confidence level. Include specific evidence excerpts that demonstrate alignment or lack thereof.`;
