import {
  type AppError,
  badRequest,
  type StandardCompletionsRequest,
  type StreamPart,
} from '@autoflow/core';
import { createMCPService } from '@backend/ai/mcp';
import type { Context } from '@backend/infrastructure/context/Context';
import {
  type LanguageModel,
  streamText,
  type TextStreamPart,
  type ToolSet,
} from 'ai';
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
      const streamPart = toStreamPart(part);
      if (streamPart) {
        yield ok(streamPart);
      }
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

/**
 * Converts SDK stream parts to domain stream parts.
 * Filters out SDK v6 tool approval features we don't support yet.
 *
 * Note: We return StreamPart rather than the SDK's TextStreamPart because
 * our domain types have slightly different providerMetadata typing (unknown vs JSONValue).
 * The runtime values are compatible.
 */
function toStreamPart(part: TextStreamPart<ToolSet>): StreamPart | undefined {
  // Skip tool-approval-request - SDK v6 feature not yet supported
  if (part.type === 'tool-approval-request') {
    return undefined;
  }
  // The SDK's TextStreamPart (minus tool-approval-request) is structurally
  // compatible with our StreamPart at runtime, though types differ slightly
  // in providerMetadata. We return the value directly.
  return part satisfies StreamPart;
}
