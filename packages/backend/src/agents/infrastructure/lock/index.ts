/**
 * Agent lock module.
 *
 * Provides distributed locking for agent execution:
 * - AgentRunLock: Prevents concurrent execution of the same agent run
 *
 * @module agents/infrastructure/lock
 */

export { createAgentRunLock, type IAgentRunLock } from './AgentRunLock';
