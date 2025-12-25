import zod from 'zod';

export type RequestToolApprovalRequestPart = zod.infer<
  typeof requestToolApprovalRequestPartSchema
>;

export const requestToolApprovalRequestPartSchema = zod
  .strictObject({
    type: zod.literal('tool-approval-request'),
    approvalId: zod.string().describe('The ID for the approval request.'),
    toolCall: zod
      .strictObject({
        toolCallId: zod
          .string()
          .describe('The ID of the tool call that is requesting approval.'),
        toolName: zod
          .string()
          .optional()
          .describe('The name of the tool requiring approval.'),
        input: zod
          .unknown()
          .optional()
          .describe(
            'The input that will be provided to the tool upon approval.',
          ),
      })
      .describe('The tool information requiring approval.'),
  })
  .describe(
    'Tool approval request part from AI SDK - indicates a tool requires approval before execution.',
  );
