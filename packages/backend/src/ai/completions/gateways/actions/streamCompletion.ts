import {
  type AppError,
  badRequest,
  type StandardCompletionsRequest,
  type StreamPart,
} from '@autoflow/core';
import { createMCPService } from '@backend/ai/mcp';
import type { Context } from '@backend/infrastructure/context/Context';
import { type LanguageModel, streamText } from 'ai';
import { err, ok, type Result } from 'neverthrow';
import type { CompletionsProvider } from '../../providers/CompletionsProviders';
import { closeMCPClients } from './utils/closeMCPClients';
import { convertCompletionRequest } from './utils/convertCompletionRequest';
import { withMCPTools } from './utils/withMCPTools';

export async function* streamCompletion(
  ctx: Context,
  provider: CompletionsProvider,
  model: LanguageModel,
  request: StandardCompletionsRequest,
  actions = {
    streamText,
    mcpService: createMCPService(),
    closeMCPClients,
  },
): AsyncGenerator<Result<StreamPart, AppError>> {
  const mcpResult = await withMCPTools({
    request,
    mcpService: actions.mcpService,
  });

  if (mcpResult.isErr()) {
    yield err(mcpResult.error);
    return;
  }

  const { tools: mergedTools, clients } = mcpResult.value;

  try {
    const response = actions.streamText({
      ...convertCompletionRequest(provider, {
        ...request,
        tools: mergedTools,
      }),
      model,
      maxRetries: 0,
      abortSignal: ctx.signal,
    });
    for await (const part of response.fullStream) {
      yield ok(part);
    }
  } catch (error) {
    yield err(
      badRequest('Failed to generate streaming completion', {
        correlationId: ctx.correlationId,
        cause: error,
      }),
    );
  } finally {
    await actions.closeMCPClients(clients);
  }
}
