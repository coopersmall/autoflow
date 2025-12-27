import type {
  RequestToolApprovalRequestPart,
  ToolApprovalSuspension,
} from '@autoflow/core';
import type { TextResponse } from '@core/domain/ai';

/**
 * Filters for all tool approval request in the completion response.
 *
 * @param response - The completion response from the gateway
 * @returns The approval request if found, undefined otherwise
 */
export function filterApprovalRequest(
  response: TextResponse,
): ToolApprovalSuspension[] {
  return response.content
    .filter(
      (part): part is RequestToolApprovalRequestPart =>
        part.type === 'tool-approval-request',
    )
    .map((part) => {
      const pendingSuspension: ToolApprovalSuspension = {
        type: 'tool-approval',
        approvalId: part.approvalId,
        toolName: part.toolCall.toolName ?? 'unknown',
        toolArgs: part.toolCall.input,
      };
      return pendingSuspension;
    });
}
