import type {
  FinishReason,
  RequestToolResultPart,
  StepResult,
  ToolCallPart,
  Usage,
} from '@core/domain/ai';

export interface BuildStepResultParams {
  readonly text: string;
  readonly toolCalls: readonly ToolCallPart[];
  readonly toolResults: readonly RequestToolResultPart[];
  readonly finishReason: FinishReason;
  readonly usage: Usage;
}

/**
 * Builds a StepResult from streaming accumulated state.
 */
export function buildStepResult(params: BuildStepResultParams): StepResult {
  const { text, toolCalls, toolResults, finishReason, usage } = params;

  const now = new Date();

  return {
    text,
    reasoning: [],
    files: [],
    sources: [],
    toolCalls: toolCalls.map((tc) => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      input: tc.input,
    })),
    toolResults: toolResults.map((tr) => ({
      toolCallId: tr.toolCallId,
      toolName: tr.toolName,
      result: tr.output,
    })),
    finishReason,
    usage,
    request: {
      body: undefined,
    },
    response: {
      timestamp: now,
      id: `step-${now.getTime()}`,
      modelId: '',
      isContinued: false,
    },
  };
}
