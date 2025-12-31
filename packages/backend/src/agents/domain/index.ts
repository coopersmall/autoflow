/**
 * Agent domain module.
 *
 * Contains domain types and interfaces for the agents framework:
 * - State management types (AgentState, AgentRunState)
 * - Configuration types (AgentManifest, AgentRunConfig)
 * - Dependency composition interfaces
 * - Constants for timeouts and TTLs
 *
 * @module agents/domain
 */

export type { AgentInput } from './AgentInput';
export type { AgentManifest } from './AgentManifest';
export type { AgentRunConfig } from './AgentRunConfig';
export type { AgentRunOptions } from './AgentRunOptions';
export type { AgentRunState } from './AgentRunState';
export type { IAgentService } from './AgentService';
export {
  type AgentState,
  type AgentStateStatus,
  agentStateSchema,
  type ContinuableStateStatus,
} from './AgentState';
export {
  type CancellationSignal,
  cancellationSignalSchema,
} from './CancellationSignal';
export {
  AGENT_CONTENT_FOLDER,
  AGENT_CONTENT_TTL_SECONDS,
  AGENT_DOWNLOAD_URL_EXPIRY_SECONDS,
  DEFAULT_AGENT_RUN_LOCK_TTL,
  DEFAULT_AGENT_STATE_TTL,
  DEFAULT_AGENT_TIMEOUT,
  DEFAULT_CANCELLATION_POLL_INTERVAL_MS,
  DEFAULT_CANCELLATION_SIGNAL_TTL,
} from './constants';
// Dependency composition
export * from './dependencies';
// Execution domain objects
export * from './execution';
export {
  type ParentAgentContext,
  parentAgentContextSchema,
} from './ParentAgentContext';
