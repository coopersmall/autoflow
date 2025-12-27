import type { PrepareDeps } from '@backend/agents/domain';
import type { PrepareResult } from '@backend/agents/domain/execution';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentInput, AgentManifest, AgentTool } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { unreachable } from '@core/unreachable';
import type { Result } from 'neverthrow';
import type { RunAgentDeps } from '../runAgent';
import { prepareFromApproval } from './prepareFromApproval';
import { prepareFromContinue } from './prepareFromContinue';
import { prepareFromReply } from './prepareFromReply';
import { prepareFromRequest } from './prepareFromRequest';

/**
 * Prepares agent run state based on input type.
 *
 * Tools are pre-built and passed in. Routes to the appropriate preparation function:
 * - request: Fresh start from AgentRequest
 * - reply: Reply to completed agent with additional message
 * - approval: Resume suspended agent after tool approval
 */
export async function prepareRunState(
  ctx: Context,
  manifest: AgentManifest,
  input: AgentInput,
  tools: AgentTool[],
  toolsMap: Map<string, AgentTool>,
  deps: PrepareDeps &
    Partial<Pick<RunAgentDeps, 'completionsGateway' | 'mcpService'>>,
): Promise<Result<PrepareResult, AppError>> {
  const options = input.options;

  switch (input.type) {
    case 'request': {
      return prepareFromRequest(ctx, manifest, input, tools, toolsMap, options);
    }

    case 'reply': {
      return prepareFromReply(
        ctx,
        manifest,
        input.runId,
        input.message,
        tools,
        toolsMap,
        deps,
        options,
      );
    }

    case 'approval': {
      return prepareFromApproval(
        ctx,
        manifest,
        input.runId,
        input.response,
        tools,
        toolsMap,
        deps,
        options,
      );
    }

    case 'continue': {
      return prepareFromContinue(
        ctx,
        manifest,
        input.runId,
        tools,
        toolsMap,
        deps,
        options,
      );
    }

    default: {
      return unreachable(input);
    }
  }
}
