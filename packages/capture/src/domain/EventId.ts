import zod from 'zod';
import { createIdSchema, newId } from '@core/domain/Id';

export type EventId = zod.infer<typeof eventIdSchema>;
export const EventId = newId<EventId>;
export const eventIdSchema = createIdSchema('EventId');
