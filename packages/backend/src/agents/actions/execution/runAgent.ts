import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { IMCPService } from '@backend/ai/mcp/domain/MCPService';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentManifest,
  AgentRequest,
  AgentRunResult,
} from '@core/domain/agents';
import type { PrepareStepResult } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { timeout } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { buildAgentResult } from '../helpers/buildAgentResult';
import { shouldStop } from '../helpers/shouldStop';
import { buildIterationMessages } from './buildIterationMessages';
import { executeToolCalls } from './executeToolCalls';
import { handleOutputValidation } from './handleOutputValidation';
import { initializeAgentRun } from './initializeAgentRun';

export interface RunAgentDeps {
  readonly completionsGateway: ICompletionsGateway;
  readonly mcpService: IMCPService;
}

/**
 * Runs an agent to completion or until suspended.
 *
 * This is the core agent execution loop that:
 * 1. Builds tools and harness
 * 2. Runs LLM steps in a loop
 * 3. Executes tool calls via the harness
 * 4. Handles suspensions and stop conditions
 * 5. Returns final result or suspension
 *
 * NOTE: Callers should validate the agent configuration before calling this function
 * using `validateAgentConfig(manifest, manifests)` to ensure sub-agent references
 * and other config validations pass. This validation will be automatic when using
 * AgentService (Phase 7), but direct callers should validate manually.
 */
export async function runAgent(
  ctx: Context,
  manifest: AgentManifest,
  request: AgentRequest,
  deps: RunAgentDeps,
): Promise<Result<AgentRunResult, AppError>> {
  // Initialize agent run state
  const initResult = await initializeAgentRun(ctx, manifest, request, {
    mcpService: deps.mcpService,
  });

  if (initResult.isErr()) {
    return err(initResult.error);
  }

  const state = initResult.value;

  const { startTime, timeoutMs, tools, toolsMap, harness } = state;
  let { messages, steps, stepNumber, outputValidationRetries } = state;

  // Main agent execution loop
  while (true) {
    // 1. Check timeout
    const currentElapsed = Date.now() - startTime;
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

    // 4. Execute tool calls via harness
    const execResult = await executeToolCalls({
      toolCalls: response.toolCalls ?? [],
      toolsMap,
      harness,
      ctx,
      messages,
      stepNumber,
    });

    // 5. Handle suspension - early return
    if (execResult.type === 'suspended') {
      // For now, return error since we don't have state persistence yet
      // TODO: Implement state persistence in Phase 4
      return err(
        timeout('Agent suspended but state persistence not yet implemented', {
          metadata: { suspension: execResult.suspension },
        }),
      );
    }

    const { toolResultParts } = execResult;

    // 6. Validate output tool if called
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

    // 7. Call onStepFinish hook
    if (manifest.hooks.onStepFinish && currentStep) {
      await manifest.hooks.onStepFinish(currentStep, ctx);
    }

    // 8. Check stopWhen conditions
    if (shouldStop(manifest.config.stopWhen, steps, stepNumber)) {
      return ok({
        status: 'complete',
        result: buildAgentResult(manifest, steps, response.finishReason),
      });
    }

    // 9. Check finish reason
    if (response.finishReason !== 'tool-calls') {
      if (
        manifest.config.onTextOnly === 'stop' ||
        manifest.config.onTextOnly === undefined
      ) {
        return ok({
          status: 'complete',
          result: buildAgentResult(manifest, steps, response.finishReason),
        });
      }
    }

    // 10. Add assistant response and tool results to messages for next iteration
    const iterationMessages = buildIterationMessages(response, toolResultParts);
    messages = [...messages, ...iterationMessages];
  }
}
