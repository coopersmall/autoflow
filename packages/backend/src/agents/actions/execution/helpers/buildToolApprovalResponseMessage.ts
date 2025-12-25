import type { ContinueResponse } from '@autoflow/core';
import type { ToolMessage } from '@core/domain/ai';

/**
 * Builds a tool message containing an approval response.
 * This message is added to the conversation history when continuing a suspended agent.
 */
export function buildToolApprovalResponseMessage(
  response: ContinueResponse,
): ToolMessage {
  return {
    role: 'tool',
    content: [
      {
        type: 'tool-approval-response',
        approvalId: response.approvalId,
        approved: response.approved,
        reason: response.reason,
      },
    ],
  };
}
