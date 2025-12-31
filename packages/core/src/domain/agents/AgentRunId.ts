import { createIdSchema, type Id, newId } from '@core/domain/Id';

export const agentRunIdSchema = createIdSchema('AgentStateId');
export type AgentRunId = Id<'AgentStateId'>;
export const AgentRunId = newId<AgentRunId>;
