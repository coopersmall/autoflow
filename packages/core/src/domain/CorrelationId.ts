import { type Id, newId } from './Id.ts';

export type CorrelationId = Readonly<Id<'CorrelationId'>>;
export const CorrelationId = newId<CorrelationId>;
