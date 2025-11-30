import { type Id, newId } from './Id';

export type CorrelationId = Readonly<Id<'CorrelationId'>>;
export const CorrelationId = newId<CorrelationId>;
