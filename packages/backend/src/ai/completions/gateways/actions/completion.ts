import {
  type AppError,
  badRequest,
  type StandardCompletionsRequest,
  type TextResponse,
} from '@autoflow/core';
import { createMCPService } from '@backend/ai/mcp';
import type { Context } from '@backend/infrastructure/context/Context';
import { generateText, type LanguageModel } from 'ai';
import { err, ok, type Result } from 'neverthrow';
import type { CompletionsProvider } from '../../providers/CompletionsProviders';
import { closeMCPClients } from './utils/closeMCPClients';
import { convertCompletionRequest } from './utils/convertCompletionRequest';
import { convertFromContentParts } from './utils/convertContentParts';
import { withMCPTools } from './utils/withMCPTools';

export interface CompletionRequest {
  provider: CompletionsProvider;
  request: StandardCompletionsRequest;
}

export async function completion(
  ctx: Context,
  provider: CompletionsProvider,
  model: LanguageModel,
  request: StandardCompletionsRequest,
  actions = {
    generateText,
    mcpService: createMCPService(),
    closeMCPClients,
  },
): Promise<Result<TextResponse, AppError>> {
  const mcpResult = await withMCPTools({
    request,
    mcpService: actions.mcpService,
  });

  if (mcpResult.isErr()) {
    return err(mcpResult.error);
  }

  const { tools: mergedTools, clients } = mcpResult.value;

  try {
    const response = await actions.generateText({
      ...convertCompletionRequest(provider, {
        ...request,
        tools: mergedTools,
      }),
      model,
      maxRetries: 0,
      abortSignal: ctx.signal,
    });

    return ok({
      ...response,
      content: convertFromContentParts(response.content),
    });
  } catch (error) {
    return err(
      badRequest('Failed to generate completion', {
        correlationId: ctx.correlationId,
        cause: error,
      }),
    );
  } finally {
    await actions.closeMCPClients(clients);
  }
}
