import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { ToolWithExecution } from '../../ai/request/completions/tools/Tool';
import type { ToolCall } from '../../ai/response/completions/shared/ToolCall';
import type { AgentEvent } from '../execution/AgentEvent';
import type { AgentToolResult } from './AgentToolResult';
import type { ToolExecutionContext } from './ToolExecutionContext';

/**
 * Streaming tool executor - yields events during execution, returns final result.
 *
 * All streaming tools use this interface. The generator yields `Result<AgentEvent, AppError>`
 * during execution (for sub-agent events, progress updates, etc.) and returns the final
 * `AgentToolResult` when done.
 *
 * Simple tools that don't need streaming yield nothing and return immediately.
 *
 * Used primarily for:
 * - Sub-agent tools (stream nested agent events)
 * - Long-running tools with progress updates
 * - Tools that need to emit intermediate results
 */
export type StreamingToolExecutor = (
  tool: ToolWithExecution,
  toolCall: ToolCall,
  execCtx: ToolExecutionContext,
) => AsyncGenerator<Result<AgentEvent, AppError>, AgentToolResult>;

/**
 * Streaming middleware wraps a streaming executor and returns a new streaming executor.
 *
 * Middleware can:
 * - Transform or filter yielded events
 * - Add logging/tracing around execution
 * - Implement timeout or retry logic
 * - Forward events from the next executor with modifications
 */
export type StreamingToolExecutionMiddleware = (
  next: StreamingToolExecutor,
) => StreamingToolExecutor;
