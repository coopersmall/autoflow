import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentInput, AgentManifest, AgentTool } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { unreachable } from '@core/unreachable';
import type { Result } from 'neverthrow';
import type { PrepareAgentRunDeps, PrepareResult } from './PrepareResult';
import { prepareFromApproval } from './prepareFromApproval';
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
  deps: PrepareAgentRunDeps,
): Promise<Result<PrepareResult, AppError>> {
  switch (input.type) {
    case 'request': {
      return prepareFromRequest(ctx, manifest, input.request, tools, toolsMap);
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
      );
    }

    default: {
      return unreachable(input);
    }
  }
}
