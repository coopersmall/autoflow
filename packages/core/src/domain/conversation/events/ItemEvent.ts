import zod from 'zod';
import { createIdSchema, newId } from '../../Id';
import { itemEventDataSchema } from './EventData';

// === ITEM EVENT ID ===

export type ItemEventId = zod.infer<typeof itemEventIdSchema>;
export const ItemEventId = newId<ItemEventId>;
export const itemEventIdSchema = createIdSchema('ItemEventId');

// === ITEM EVENT ===

export const itemEventSchema = zod.strictObject({
  id: itemEventIdSchema.describe('unique identifier for this event'),
  timestamp: zod.coerce
    .date()
    .describe('absolute timestamp when the event occurred'),
  data: itemEventDataSchema.describe('the event data payload'),
});

export type ItemEvent = zod.infer<typeof itemEventSchema>;
