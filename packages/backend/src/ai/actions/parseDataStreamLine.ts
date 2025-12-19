import type { Context } from '@backend/infrastructure/context';
import type { StreamPart } from '@core/domain/ai/streamingPart';
import {
  validAnnotationsArray,
  validDataArray,
  validFilePart,
  validFinishMessagePart,
  validFinishStepPart,
  validReasoningSignaturePart,
  validRedactedReasoningPart,
  validSourcePart,
  validStartStepPart,
  validStringContent,
  validToolCallDeltaPart,
  validToolCallPart,
  validToolCallStreamingStartPart,
  validToolResultPart,
} from '@core/domain/ai/validation/validStreamPart';
import { type AppError, internalError } from '@core/errors';
import { err, ok, type Result } from 'neverthrow';

export function parseDataStreamLine(
  ctx: Context,
  line: string,
): Result<StreamPart, AppError> {
  const correlationId = ctx.correlationId;
  if (!line.trim()) {
    return ok({
      type: 'text',
      content: '',
    }); // Empty line, skip
  }

  // Find the first colon to separate type from content
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) {
    return err(
      internalError('Invalid stream line format: missing colon', {
        metadata: { correlationId, line },
      }),
    );
  }

  const typeId = line.slice(0, colonIndex);
  const contentStr = line.slice(colonIndex + 1);

  try {
    const parsedContent = JSON.parse(contentStr);

    switch (typeId) {
      case '0': {
        // Text part: 0:"example"
        const contentResult = validStringContent(parsedContent);
        if (contentResult.isErr()) {
          return err(
            internalError('Invalid text content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: contentResult.error,
              },
            }),
          );
        }
        return ok({ type: 'text', content: contentResult.value });
      }

      case 'g': {
        // Reasoning part: g:"I will open the conversation with witty banter."
        const contentResult = validStringContent(parsedContent);
        if (contentResult.isErr()) {
          return err(
            internalError('Invalid reasoning content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: contentResult.error,
              },
            }),
          );
        }
        return ok({ type: 'reasoning', content: contentResult.value });
      }

      case 'i': {
        // Redacted reasoning part: i:{"data": "This reasoning has been redacted for security purposes."}
        const validatedResult = validRedactedReasoningPart(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError('Invalid redacted reasoning content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: validatedResult.error,
              },
            }),
          );
        }
        return ok(validatedResult.value);
      }

      case 'j': {
        // Reasoning signature part: j:{"signature": "abc123xyz"}
        const validatedResult = validReasoningSignaturePart(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError(
              'Invalid reasoning signature content in stream line',
              {
                metadata: {
                  correlationId,
                  line,
                  validationError: validatedResult.error,
                },
              },
            ),
          );
        }
        return ok(validatedResult.value);
      }

      case 'h': {
        // Source part: h:{"sourceType":"url","id":"source-id","url":"https://example.com","title":"Example"}
        const validatedResult = validSourcePart(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError('Invalid source content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: validatedResult.error,
              },
            }),
          );
        }
        return ok(validatedResult.value);
      }

      case 'k': {
        // File part: k:{"data":"base64EncodedData","mimeType":"image/png"}
        const validatedResult = validFilePart(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError('Invalid file content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: validatedResult.error,
              },
            }),
          );
        }
        return ok(validatedResult.value);
      }

      case '2': {
        // Data part: 2:[{"key":"object1"},{"anotherKey":"object2"}]
        const validatedResult = validDataArray(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError('Invalid data content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: validatedResult.error,
              },
            }),
          );
        }
        return ok({ type: 'data', content: validatedResult.value });
      }

      case '8': {
        // Message annotation part: 8:[{"id":"message-123","other":"annotation"}]
        const validatedResult = validAnnotationsArray(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError('Invalid message annotation content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: validatedResult.error,
              },
            }),
          );
        }
        return ok({
          type: 'message-annotation',
          annotations: validatedResult.value,
        });
      }

      case '3': {
        // Error part: 3:"error message"
        const validatedResult = validStringContent(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError('Invalid error message content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: validatedResult.error,
              },
            }),
          );
        }
        return ok({ type: 'error', message: validatedResult.value });
      }

      case 'b': {
        // Tool call streaming start part: b:{"toolCallId":"call-456","toolName":"streaming-tool"}
        const validatedResult = validToolCallStreamingStartPart(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError(
              'Invalid tool call streaming start content in stream line',
              {
                metadata: {
                  correlationId,
                  line,
                  validationError: validatedResult.error,
                },
              },
            ),
          );
        }
        return ok(validatedResult.value);
      }

      case 'c': {
        // Tool call delta part: c:{"toolCallId":"call-456","argsTextDelta":"partial arg"}
        const validatedResult = validToolCallDeltaPart(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError('Invalid tool call delta content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: validatedResult.error,
              },
            }),
          );
        }
        return ok(validatedResult.value);
      }

      case '9': {
        // Tool call part: 9:{"toolCallId":"call-123","toolName":"my-tool","args":{"some":"argument"}}
        const validatedResult = validToolCallPart(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError('Invalid tool call content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: validatedResult.error,
              },
            }),
          );
        }
        return ok(validatedResult.value);
      }

      case 'a': {
        // Tool result part: a:{"toolCallId":"call-123","result":"tool output"}
        const validatedResult = validToolResultPart(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError('Invalid tool result content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: validatedResult.error,
              },
            }),
          );
        }
        return ok(validatedResult.value);
      }

      case 'f': {
        // Start step part: f:{"messageId":"step_123"}
        const validatedResult = validStartStepPart(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError('Invalid start step content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: validatedResult.error,
              },
            }),
          );
        }
        return ok(validatedResult.value);
      }

      case 'e': {
        // Finish step part: e:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20},"isContinued":false}
        const validatedResult = validFinishStepPart(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError('Invalid finish step content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: validatedResult.error,
              },
            }),
          );
        }
        return ok(validatedResult.value);
      }

      case 'd': {
        // Finish message part: d:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20}}
        const validatedResult = validFinishMessagePart(parsedContent);
        if (validatedResult.isErr()) {
          return err(
            internalError('Invalid finish message content in stream line', {
              metadata: {
                correlationId,
                line,
                validationError: validatedResult.error,
              },
            }),
          );
        }
        return ok(validatedResult.value);
      }

      default:
        return err(
          internalError('Unknown stream part type', {
            metadata: {
              correlationId,
              line,
              unknownTypeId: typeId,
            },
          }),
        );
    }
  } catch (jsonError) {
    return err(
      internalError('Invalid JSON in stream line', {
        cause: jsonError,
        metadata: { correlationId, line },
      }),
    );
  }
}
