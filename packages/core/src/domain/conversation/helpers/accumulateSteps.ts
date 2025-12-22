import type { Usage } from '../../ai/response';
import type { ItemEvent } from '../events/ItemEvent';
import type { Source } from '../shared/Source';
import type { ToolCallResult } from '../shared/ToolCallResult';
import type { Step } from '../steps/Step';
import type { StepContent } from '../steps/StepContent';

/**
 * Result of accumulating streaming events into steps.
 */
export interface AccumulatedResult {
  /** Completed steps from the stream */
  steps: Step[];
  /** Total token usage across all steps */
  totalUsage: Usage;
}

/**
 * Internal state for accumulating a single step's content.
 */
interface StepAccumulator {
  stepIndex: number;
  startedAt: Date;
  textDeltas: string[];
  reasoningDeltas: string[];
  toolsMap: Map<string, ToolCallResult>;
  sourcesMap: Map<string, Source>;
}

/**
 * Creates an empty step accumulator for a new step.
 */
function createStepAccumulator(
  stepIndex: number,
  startedAt: Date,
): StepAccumulator {
  return {
    stepIndex,
    startedAt,
    textDeltas: [],
    reasoningDeltas: [],
    toolsMap: new Map(),
    sourcesMap: new Map(),
  };
}

/**
 * Builds StepContent from accumulated deltas.
 */
function buildStepContent(accumulator: StepAccumulator): StepContent {
  const content: StepContent = {};

  if (accumulator.textDeltas.length > 0) {
    content.text = accumulator.textDeltas.join('');
  }

  if (accumulator.reasoningDeltas.length > 0) {
    content.reasoning = accumulator.reasoningDeltas.join('');
  }

  if (accumulator.toolsMap.size > 0) {
    content.tools = Array.from(accumulator.toolsMap.values());
  }

  if (accumulator.sourcesMap.size > 0) {
    content.sources = Array.from(accumulator.sourcesMap.values());
  }

  return content;
}

/**
 * Adds two Usage objects together.
 */
function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: (a.inputTokens ?? 0) + (b.inputTokens ?? 0),
    outputTokens: (a.outputTokens ?? 0) + (b.outputTokens ?? 0),
    totalTokens: (a.totalTokens ?? 0) + (b.totalTokens ?? 0),
    reasoningTokens:
      a.reasoningTokens !== undefined || b.reasoningTokens !== undefined
        ? (a.reasoningTokens ?? 0) + (b.reasoningTokens ?? 0)
        : undefined,
    cachedInputTokens:
      a.cachedInputTokens !== undefined || b.cachedInputTokens !== undefined
        ? (a.cachedInputTokens ?? 0) + (b.cachedInputTokens ?? 0)
        : undefined,
  };
}

/**
 * Creates an empty Usage object.
 */
function emptyUsage(): Usage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}

/**
 * Accumulates streaming events into complete steps.
 *
 * This processes step lifecycle events (step-start, step-finish) along with
 * content events (text-delta, reasoning-delta, tool-call, tool-result, etc.)
 * to build a list of completed steps with their content.
 *
 * Note: Files are NOT accumulated here. The caller is responsible for:
 * 1. Collecting file-generated events from the stream
 * 2. Uploading files via the FilePayload side-channel
 * 3. Building the file attachments array with upload results
 *
 * @param events - Array of ItemEvents to accumulate
 * @returns The accumulated steps and total usage
 */
export function accumulateSteps(events: ItemEvent[]): AccumulatedResult {
  const steps: Step[] = [];
  let currentStep: StepAccumulator | null = null;
  let totalUsage: Usage = emptyUsage();

  for (const event of events) {
    const data = event.data;

    switch (data.type) {
      case 'step-start':
        // Start a new step
        currentStep = createStepAccumulator(data.stepIndex, event.timestamp);
        break;

      case 'step-finish':
        // Finalize the current step
        if (currentStep) {
          const content = buildStepContent(currentStep);

          steps.push({
            stepIndex: currentStep.stepIndex,
            content,
            usage: data.usage,
            finishReason: data.finishReason,
            isContinued: data.isContinued,
            startedAt: currentStep.startedAt,
            finishedAt: event.timestamp,
          });

          // Accumulate total usage
          totalUsage = addUsage(totalUsage, data.usage);
        }
        currentStep = null;
        break;

      case 'text-delta':
        if (currentStep) {
          currentStep.textDeltas.push(data.text);
        }
        break;

      case 'reasoning-delta':
        if (currentStep) {
          currentStep.reasoningDeltas.push(data.text);
        }
        break;

      case 'tool-call': {
        if (currentStep) {
          currentStep.toolsMap.set(data.toolCallId, {
            toolCallId: data.toolCallId,
            toolName: data.toolName,
            input: data.input,
            timestamp: event.timestamp,
          });
        }
        break;
      }

      case 'tool-result': {
        if (currentStep) {
          const existing = currentStep.toolsMap.get(data.toolCallId);
          if (existing) {
            existing.output = data.output;
          } else {
            currentStep.toolsMap.set(data.toolCallId, {
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              input: data.input,
              output: data.output,
              timestamp: event.timestamp,
            });
          }
        }
        break;
      }

      case 'tool-error': {
        if (currentStep) {
          const existing = currentStep.toolsMap.get(data.toolCallId);
          if (existing) {
            existing.output = data.error;
            existing.isError = true;
          } else {
            currentStep.toolsMap.set(data.toolCallId, {
              toolCallId: data.toolCallId,
              toolName: data.toolName,
              input: data.input,
              output: data.error,
              isError: true,
            });
          }
        }
        break;
      }

      case 'source': {
        if (currentStep) {
          if (data.content.sourceType === 'url') {
            currentStep.sourcesMap.set(data.id, {
              sourceType: 'url',
              id: data.id,
              url: data.content.url,
              title: data.title,
            });
          } else {
            currentStep.sourcesMap.set(data.id, {
              sourceType: 'document',
              id: data.id,
              title: data.title,
              filename: data.content.filename,
              mediaType: data.content.mediaType,
            });
          }
        }
        break;
      }

      // file-generated events are not accumulated here
      // The caller handles file uploads and builds FileReference[]
      case 'file-generated':
        break;

      // Tool input streaming events are for real-time UI only, not accumulated
      // The complete input is available in the tool-call event
      case 'tool-input-start':
      case 'tool-input-end':
      case 'tool-input-delta':
        break;

      // Lifecycle events don't contribute to step content
      case 'start':
      case 'finish':
      case 'error':
      case 'abort':
        break;

      // Text/reasoning start/end events are lifecycle markers, not content
      case 'text-start':
      case 'text-end':
      case 'reasoning-start':
      case 'reasoning-end':
        break;
    }
  }

  return { steps, totalUsage };
}
