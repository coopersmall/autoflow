import { type Id, newId } from './Id';

export type CorrelationId = Id<'CorrelationId'>;
export const CorrelationId = newId<CorrelationId>;
