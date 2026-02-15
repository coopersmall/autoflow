import { eventIdSchema } from '@capture/domain/EventId';
import zod from 'zod';

export const domMutationTypeSchema = zod.enum([
  'added',
  'removed',
  'modified',
  'text-changed',
]);
export type DomMutationType = zod.infer<typeof domMutationTypeSchema>;

export const domMutationSchema = zod.object({
  type: domMutationTypeSchema.describe('the type of DOM mutation'),
  selector: zod.string().describe('CSS selector of the affected element'),
  tagName: zod.string().describe('the tag name of the element'),
  attributes: zod
    .record(zod.string())
    .optional()
    .describe('changed attributes'),
  textContent: zod.string().optional().describe('text content if changed'),
  shadowRoot: zod
    .enum(['open', 'closed', 'none'])
    .optional()
    .describe('shadow root mode if present'),
});
export type DomMutation = zod.infer<typeof domMutationSchema>;

export const domChangeEventSchema = zod.object({
  id: eventIdSchema,
  type: zod.literal('dom-change'),
  timestamp: zod.coerce.date().describe('when the mutation was observed'),
  mutations: zod
    .array(domMutationSchema)
    .min(1)
    .describe('the DOM mutations in this batch'),
});
export type DomChangeEvent = zod.infer<typeof domChangeEventSchema>;
