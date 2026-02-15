import type { AppError } from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';
import {
  createComponentScore,
  type EvaluationContext,
  type LlmJudgeResponse,
} from './evaluateComponent.js';

// Grounding/factuality evaluation input
export const groundingInputSchema = zod.object({
  questions: zod.array(
    zod.object({
      question: zod.string().min(1),
      knownAnswer: zod.string().min(1),
      acceptablePatterns: zod.array(zod.string()).min(1),
      agentResponse: zod.string(),
    }),
  ),
});

export type GroundingInput = zod.infer<typeof groundingInputSchema>;

// Evaluates grounding/factuality
export function evaluateGrounding(
  input: GroundingInput,
  ctx: EvaluationContext,
  judgeResponse?: LlmJudgeResponse,
): Result<ComponentScore, AppError> {
  ctx.logger.info('Evaluating grounding component', {
    questionCount: input.questions.length,
  });

  // If judge response provided, use it; otherwise compute simple pattern match
  let judge: LlmJudgeResponse;
  if (judgeResponse) {
    judge = judgeResponse;
  } else {
    // Simple heuristic: check if agent responses contain acceptable patterns
    let correctCount = 0;
    const evidence: Array<{
      type: 'user' | 'agent';
      content: string;
      timestamp: string;
      relevanceReason: string;
    }> = [];

    for (const q of input.questions) {
      const response = q.agentResponse.toLowerCase();
      const matches = q.acceptablePatterns.some((p) =>
        response.includes(p.toLowerCase()),
      );
      if (matches) correctCount++;

      evidence.push({
        type: 'agent',
        content: q.agentResponse,
        timestamp: new Date().toISOString(),
        relevanceReason: matches
          ? 'Response contains acceptable answer pattern'
          : 'Response did not match any acceptable patterns',
      });
    }

    const score = Math.round((correctCount / input.questions.length) * 4) + 1;
    judge = {
      reasoning: `${correctCount}/${input.questions.length} responses matched acceptable answer patterns.`,
      score: Math.max(1, Math.min(5, score)),
      confidence: 0.7,
      evidence,
    };
  }

  return createComponentScore('grounding', judge);
}

// Prompt template for grounding LLM judge
export const GROUNDING_JUDGE_PROMPT = `You are evaluating an AI agent's factual accuracy and grounding.

Questions and Agent Responses:
{{questions}}

Known Correct Answers:
{{knownAnswers}}

For each response, determine if it:
1. Contains factually correct information
2. Matches the known correct answer or acceptable patterns
3. Avoids hallucinations or fabricated information

Score the agent's grounding on a scale of 1-5:
- 5: All responses are factually accurate and well-grounded
- 4: Most responses accurate with minor errors
- 3: Mixed accuracy, some hallucinations
- 2: Frequent inaccuracies or hallucinations
- 1: Mostly inaccurate or fabricated information

Provide your reasoning, score, and confidence level.`;
