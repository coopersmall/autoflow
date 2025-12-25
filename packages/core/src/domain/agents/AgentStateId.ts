import { createIdSchema, type Id, newId } from '@core/domain/Id';

export const agentStateIdSchema = createIdSchema('AgentStateId');
export type AgentStateId = Id<'AgentStateId'>;
export const AgentStateId = newId<AgentStateId>;
