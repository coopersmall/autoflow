import { eventIdSchema } from '@capture/domain/EventId';
import zod from 'zod';

export const userActionTypeSchema = zod.enum([
  'click',
  'input',
  'submit',
  'scroll',
  'keypress',
]);
export type UserActionType = zod.infer<typeof userActionTypeSchema>;

export const userActionEventSchema = zod.object({
  id: eventIdSchema,
  type: zod.literal('user-action'),
  timestamp: zod.coerce.date().describe('when the action occurred'),
  actionType: userActionTypeSchema.describe('the kind of user action'),
  selector: zod.string().describe('CSS selector of the target element'),
  tagName: zod.string().describe('the tag name of the target element'),
  value: zod.string().optional().describe('input value or key pressed'),
  coordinates: zod
    .object({
      x: zod.number(),
      y: zod.number(),
    })
    .optional()
    .describe('click coordinates relative to viewport'),
});
export type UserActionEvent = zod.infer<typeof userActionEventSchema>;
