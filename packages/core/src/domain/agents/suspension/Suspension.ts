import { z as zod } from 'zod';

export const toolApprovalSuspensionSchema = zod.strictObject({
  type: zod.literal('tool-approval'),
  approvalId: zod.string(),
  toolName: zod.string(),
  toolArgs: zod.unknown(),
  description: zod.string().optional(),
});

// Note: MCP elicitation deferred to future version
export const suspensionSchema = toolApprovalSuspensionSchema;

export type Suspension = zod.infer<typeof suspensionSchema>;
export type ToolApprovalSuspension = zod.infer<
  typeof toolApprovalSuspensionSchema
>;
