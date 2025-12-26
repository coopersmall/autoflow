import type { AgentRunState } from '@backend/agents/domain';
import { buildToolExecutionHarness } from '@backend/agents/infrastructure/harness';
import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentManifest,
  AgentResult,
  ToolApprovalSuspension,
} from '@core/domain/agents';
import type { PrepareStepResult } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { timeout } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { buildAgentResult } from '../helpers/buildAgentResult';
import { filterApprovalRequest } from '../helpers/filterApprovalRequest';
import { shouldStop } from '../helpers/shouldStop';
import { buildIterationMessages } from '../initialize/buildIterationMessages';
import { executeToolCalls } from './executeToolCalls';
import { handleOutputValidation } from './handleOutputValidation';

export interface ExecuteAgentLoopDeps {
  readonly completionsGateway: ICompletionsGateway;
}

export interface ExecuteAgentLoopParams {
  readonly ctx: Context;
  readonly manifest: AgentManifest;
  readonly state: AgentRunState;
  readonly previousElapsedMs?: number;
}

/**
 * Result from agent execution loop.
 * Includes final state for persistence by the caller.
 */
export type AgentLoopResult =
  | { status: 'complete'; result: AgentResult; finalState: AgentRunState }
  | {
      status: 'suspended';
      suspensions: ToolApprovalSuspension[];
      finalState: AgentRunState;
    }
  | { status: 'error'; error: AppError; finalState: AgentRunState };

/**
 * Pure agent execution loop - no side effects (no state persistence).
 *
 * This is the shared loop used by runAgent for all execution types.
 * It:
 * 1. Runs LLM steps in a loop
 * 2. Executes tool calls via the harness
 * 3. Handles suspensions and stop conditions
 * 4. Returns final result with updated state
 *
 * The caller is responsible for persisting state.
 */
export async function executeAgentLoop(
  params: ExecuteAgentLoopParams,
  deps: ExecuteAgentLoopDeps,
): Promise<Result<AgentLoopResult, AppError>> {
  const { ctx, manifest, state, previousElapsedMs = 0 } = params;

  const { startTime, timeoutMs, tools, toolsMap } = state;
  let { messages, steps, stepNumber, outputValidationRetries } = state;

  const harness = buildToolExecutionHarness(manifest.config);

  // Main agent execution loop
  while (true) {
    // 1. Check timeout (includes elapsed time from previous runs)
    const currentElapsed = previousElapsedMs + (Date.now() - startTime);
    if (currentElapsed > timeoutMs) {
      return err(
        timeout('Agent execution timeout', {
          metadata: { elapsedMs: currentElapsed, timeoutMs },
        }),
      );
    }

    stepNumber++;

    // 2. Call prepareStep hook (can modify messages, toolChoice, activeTools)
    let prepareResult: PrepareStepResult | undefined;
    if (manifest.hooks.prepareStep) {
      prepareResult = await manifest.hooks.prepareStep({
        stepNumber,
        steps,
        messages,
        provider: manifest.config.provider.provider,
        model: manifest.config.provider.model,
      });
      if (prepareResult?.messages) {
        messages = prepareResult.messages;
      }
    }

    // 3. Build completion request with single-step stopWhen
    const completionResult = await deps.completionsGateway.completion(
      ctx,
      manifest.config.provider,
      {
        messages,
        tools,
        stopWhen: [{ type: 'stepCount', stepCount: 1 }],
        toolChoice: prepareResult?.toolChoice,
        activeTools: prepareResult?.activeTools,
        mcpServers: manifest.config.mcpServers,
      },
    );

    if (completionResult.isErr()) {
      return err(completionResult.error);
    }

    const response = completionResult.value;

    // 4. Check for tool-approval-request in response (current agent's HITL)
    const approvalRequests = filterApprovalRequest(response);
    if (approvalRequests && approvalRequests.length > 0) {
      return ok({
        status: 'suspended',
        suspensions: approvalRequests,
        finalState: {
          ...state,
          messages: [...messages, ...buildIterationMessages(response, [])],
          steps,
          stepNumber,
          outputValidationRetries,
        },
      });
    }

    // 5. Execute tool calls via harness
    const execResult = await executeToolCalls({
      toolCalls: response.toolCalls ?? [],
      toolsMap,
      harness,
      ctx,
      messages,
      stepNumber,
    });

    // 6. Handle sub-agent suspension (recursive signal from nested runAgent)
    if (execResult.type === 'suspended') {
      return ok({
        status: 'suspended',
        suspensions: execResult.suspensions,
        finalState: {
          ...state,
          messages: [...messages, ...buildIterationMessages(response, [])],
          steps,
          stepNumber,
          outputValidationRetries,
        },
      });
    }

    // 7. Extract tool results - we know execResult.type === 'completed' here
    const toolResultParts = execResult.toolResultParts;

    // 8. Validate output tool if called
    const validationAction = handleOutputValidation({
      response,
      outputToolConfig: manifest.config.outputTool,
      currentRetries: outputValidationRetries,
    });

    if (validationAction.action === 'error') {
      return err(validationAction.error);
    }

    if (validationAction.action === 'retry') {
      messages = [...messages, ...validationAction.retryMessages];
      outputValidationRetries++;
      continue;
    }

    // Extract step result from the response
    const currentStep = response.steps[response.steps.length - 1];
    if (currentStep) {
      steps.push(currentStep);
    }

    // 9. Call onStepFinish hook
    if (manifest.hooks.onStepFinish && currentStep) {
      await manifest.hooks.onStepFinish(currentStep, ctx);
    }

    // 10. Check stopWhen conditions
    if (
      shouldStop({
        manifest,
        finishReason: response.finishReason,
        steps,
        currentStepNumber: stepNumber,
      })
    ) {
      return ok({
        status: 'complete',
        result: buildAgentResult(manifest, steps, response.finishReason),
        finalState: {
          ...state,
          messages: [
            ...messages,
            ...buildIterationMessages(response, toolResultParts),
          ],
          steps,
          stepNumber,
          outputValidationRetries,
        },
      });
    }

    // 11. Add assistant response and tool results to messages for next iteration
    const iterationMessages = buildIterationMessages(response, toolResultParts);
    messages = [...messages, ...iterationMessages];
  }
}
