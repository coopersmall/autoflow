import type { CorrelationId } from '@core/domain/CorrelationId';

/**
 * Minimal context interface for agent operations.
 *
 * This is a subset of the backend's full Context type, allowing core types
 * to remain independent of backend implementations. Backend's Context
 * satisfies this interface.
 *
 * Used by:
 * - ToolExecutionContext for tool execution
 * - Observer hooks for lifecycle events
 * - Any agent operation that needs request correlation and cancellation
 */
export interface AgentContext {
  /** Correlation ID for request tracing */
  readonly correlationId: CorrelationId;
  /** AbortSignal for cancellation */
  readonly signal: AbortSignal;
}
