import type { AgentRequest } from '../execution/AgentRequest';

/**
 * Maps sub-agent tool arguments to AgentRequest.
 * Used in AgentManifestHooks.subAgentMappers.
 */
export type SubAgentMapperFunction = (args: unknown) => AgentRequest;
