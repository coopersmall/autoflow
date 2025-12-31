import zod from 'zod';

export type RequestToolApprovalResponsePart = zod.infer<
  typeof requestToolApprovalResponsePartSchema
>;

export const requestToolApprovalResponsePartSchema = zod
  .strictObject({
    type: zod.literal('tool-approval-response'),
    approvalId: zod.string(),
    approved: zod.boolean(),
    reason: zod.string().optional(),
  })
  .describe(
    'Tool approval response part - sent in tool message to indicate user approval/denial.',
  );
