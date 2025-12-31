import { z as zod } from 'zod';

export const continueResponseSchema = zod.strictObject({
  type: zod.literal('approval'),
  approvalId: zod.string(),
  approved: zod.boolean(),
  reason: zod.string().optional(),
});

export type ContinueResponse = zod.infer<typeof continueResponseSchema>;
