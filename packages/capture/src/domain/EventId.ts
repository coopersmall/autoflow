import { createIdSchema, newId } from '@core/domain/Id';
import type zod from 'zod';

export type EventId = zod.infer<typeof eventIdSchema>;
export const EventId = newId<EventId>;
export const eventIdSchema = createIdSchema('EventId');
