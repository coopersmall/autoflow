import type {
  AIProvider,
  OnStepFinishFunction,
  OnStepFinishResult,
  PrepareStepFunction,
  PrepareStepOptions,
  PrepareStepResult,
  StepResult,
  ToolChoice,
} from '@autoflow/core';
import type {
  PrepareStepFunction as AISDKPrepareStep,
  StepResult as AISDKStepResult,
  ToolChoice as AISDKToolChoice,
  LanguageModel,
  ModelMessage,
  ToolSet,
} from 'ai';
import {
  convertFromModelMessages,
  convertToModelMessages,
} from './convertMessages';

/**
 * Converts domain StepResult from AI SDK StepResult.
 */
function convertFromAISDKStepResult(
  step: AISDKStepResult<ToolSet>,
): StepResult {
  return {
    text: step.text,
    reasoning: step.reasoning.map((r) => ({
      type: 'reasoning' as const,
      text: r.text,
    })),
    reasoningText: step.reasoningText,
    files: step.files.map((f) => ({
      mediaType: f.mediaType,
      uint8Array: f.uint8Array,
    })),
    sources: step.sources,
    toolCalls: step.toolCalls.map((tc) => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      input: tc.input,
    })),
    toolResults: step.toolResults.map((tr) => ({
      toolCallId: tr.toolCallId,
      toolName: tr.toolName,
      input: tr.input,
      output: tr.output,
    })),
    finishReason: step.finishReason,
    usage: {
      inputTokens: step.usage.inputTokens,
      outputTokens: step.usage.outputTokens,
      totalTokens: step.usage.totalTokens,
      reasoningTokens: step.usage.reasoningTokens,
      cachedInputTokens: step.usage.cachedInputTokens,
    },
    warnings: step.warnings,
    request: {
      body: step.request.body,
    },
    response: {
      id: step.response.id,
      timestamp: step.response.timestamp,
      modelId: step.response.modelId,
      headers: step.response.headers,
    },
    providerMetadata: step.providerMetadata,
  };
}

/**
 * Converts domain ToolChoice to AI SDK ToolChoice.
 */
function convertToAISDKToolChoice(
  toolChoice: ToolChoice | undefined,
): AISDKToolChoice<ToolSet> | undefined {
  if (toolChoice === undefined) {
    return undefined;
  }
  if (typeof toolChoice === 'string') {
    return toolChoice;
  }
  return toolChoice;
}

/**
 * Type for AI SDK PrepareStepOptions.
 * Uses the actual LanguageModel type from the AI SDK.
 */
type AISDKPrepareStepOptions = {
  steps: AISDKStepResult<ToolSet>[];
  stepNumber: number;
  model: LanguageModel;
  messages: ModelMessage[];
};

/**
 * Type for AI SDK PrepareStepResult.
 */
type AISDKPrepareStepResult = {
  toolChoice?: AISDKToolChoice<ToolSet>;
  activeTools?: string[];
  system?: string;
  messages?: ModelMessage[];
};

/**
 * Extracts provider and modelId from a LanguageModel.
 * LanguageModel can be either a string or an object with provider/modelId.
 */
function extractModelInfo(model: LanguageModel): {
  provider: string;
  modelId: string;
} {
  if (typeof model === 'string') {
    // If model is a string, try to extract provider from format "provider:model"
    const parts = model.split(':');
    if (parts.length >= 2 && parts[0] !== undefined && parts[1] !== undefined) {
      return { provider: parts[0], modelId: parts.slice(1).join(':') };
    }
    return { provider: 'unknown', modelId: model };
  }
  // Model is an object with provider and modelId properties
  return {
    provider: model.provider,
    modelId: model.modelId,
  };
}

/**
 * Converts domain PrepareStepOptions from AI SDK PrepareStepOptions.
 */
function convertFromAISDKPrepareStepOptions(
  options: AISDKPrepareStepOptions,
): PrepareStepOptions {
  const modelInfo = extractModelInfo(options.model);
  return {
    steps: options.steps.map(convertFromAISDKStepResult),
    stepNumber: options.stepNumber,
    provider: modelInfo.provider as AIProvider,
    model: modelInfo.modelId,
    messages: convertFromModelMessages(options.messages),
  };
}

/**
 * Converts domain PrepareStepResult to AI SDK PrepareStepResult.
 */
function convertToAISDKPrepareStepResult(
  result: PrepareStepResult,
): AISDKPrepareStepResult {
  return {
    toolChoice: convertToAISDKToolChoice(result.toolChoice),
    activeTools: result.activeTools,
    system: result.system,
    messages: result.messages
      ? convertToModelMessages(result.messages)
      : undefined,
  };
}

/**
 * Wraps a domain prepareStep function to work with AI SDK types.
 * Converts AI SDK types to domain types, calls the domain function,
 * then converts the result back to AI SDK types.
 */
export function convertPrepareStep(
  prepareStep: PrepareStepFunction | undefined,
): AISDKPrepareStep<ToolSet> | undefined {
  if (prepareStep === undefined) {
    return undefined;
  }

  return async (options) => {
    const domainOptions = convertFromAISDKPrepareStepOptions(options);
    const result = await prepareStep(domainOptions);
    return convertToAISDKPrepareStepResult(result);
  };
}

/**
 * Converts AI SDK OnStepFinishResult to domain OnStepFinishResult.
 */
function convertFromAISDKOnStepFinishResult(
  result: AISDKStepResult<ToolSet> & { response?: { isContinued?: boolean } },
): OnStepFinishResult {
  const baseResult = convertFromAISDKStepResult(result);
  return {
    ...baseResult,
    response: baseResult.response
      ? {
          ...baseResult.response,
          isContinued: result.response?.isContinued ?? false,
        }
      : undefined,
  };
}

/**
 * Wraps a domain onStepFinish function to work with AI SDK types.
 * Converts AI SDK result to domain types before calling the domain function.
 */
export function convertOnStepFinish(
  onStepFinish: OnStepFinishFunction | undefined,
): ((result: AISDKStepResult<ToolSet>) => void | Promise<void>) | undefined {
  if (onStepFinish === undefined) {
    return undefined;
  }

  return async (result: AISDKStepResult<ToolSet>) => {
    const domainResult = convertFromAISDKOnStepFinishResult(result);
    await onStepFinish(domainResult);
  };
}
