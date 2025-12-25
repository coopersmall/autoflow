import { createIdSchema, type Id, newId } from '@core/domain/Id';

export const agentIdSchema = createIdSchema('AgentId');
export type AgentId = Id<'AgentId'>;
export const AgentId = newId<AgentId>;
