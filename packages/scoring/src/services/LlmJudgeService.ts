import type { AppError } from '@autoflow/core';
import { err, ok, type Result } from 'neverthrow';
import { generateText } from 'ai';
import zod from 'zod';
import {
  type LlmJudgeResponse,
  llmJudgeResponseSchema,
} from '../actions/evaluateComponent.js';

// LLM Judge service context
export interface LlmJudgeContext {
  logger: {
    info: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
  };
  correlationId: string;
  signal?: AbortSignal;
}

// LLM model configuration
export interface LlmModelConfig {
  provider: string;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
}

// Creates an LLM judge service
export function createLlmJudgeService(
  modelConfig: LlmModelConfig,
  deps: {
    getModel: (config: LlmModelConfig) => ReturnType<typeof import('ai').createOpenAI>;
  },
) {
  return {
    // Evaluate with LLM-as-Judge
    async evaluate(
      prompt: string,
      context: LlmJudgeContext,
    ): Promise<Result<LlmJudgeResponse, AppError>> {
      context.logger.info('Running LLM-as-Judge evaluation', {
        model: modelConfig.modelId,
      });

      try {
        const model = deps.getModel(modelConfig);

        const response = await generateText({
          model: model(modelConfig.modelId),
          prompt: `You are an impartial evaluator. Respond with a JSON object containing:
- reasoning: string (your detailed evaluation reasoning)
- score: number (1-5 scale)
- confidence: number (0-1)
- evidence: array of objects with type ("user" or "agent"), content, timestamp, and relevanceReason

${prompt}`,
          temperature: modelConfig.temperature ?? 0.3,
          maxTokens: modelConfig.maxTokens ?? 1000,
          abortSignal: context.signal,
        });

        // Parse the response as JSON
        const text = response.text;
        let parsed: unknown;
        try {
          // Try to extract JSON from the response
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            parsed = JSON.parse(text);
          }
        } catch {
          context.logger.error('Failed to parse LLM response as JSON', {
            response: text,
          });
          return err({
            type: 'internal_error',
            message: 'Failed to parse LLM judge response',
            metadata: { response: text },
          });
        }

        // Validate the parsed response
        const result = llmJudgeResponseSchema.safeParse(parsed);
        if (!result.success) {
          context.logger.error('LLM judge response validation failed', {
            errors: result.error.errors,
          });
          return err({
            type: 'bad_request',
            message: 'Invalid LLM judge response format',
            metadata: { errors: result.error.errors },
          });
        }

        context.logger.info('LLM-as-Judge evaluation complete', {
          score: result.data.score,
          confidence: result.data.confidence,
        });

        return ok(result.data);
      } catch (error) {
        context.logger.error('LLM judge evaluation failed', { error });
        return err({
          type: 'internal_error',
          message: 'LLM judge evaluation failed',
          metadata: { cause: error },
        });
      }
    },
  };
}

export type LlmJudgeService = ReturnType<typeof createLlmJudgeService>;
