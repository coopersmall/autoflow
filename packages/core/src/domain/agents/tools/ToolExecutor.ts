import type { ToolWithExecution } from '../../ai/request/completions/tools/Tool';
import type { ToolCall } from '../../ai/response/completions/shared/ToolCall';
import type { AgentToolResult } from './AgentToolResult';
import type { ToolExecutionContext } from './ToolExecutionContext';

// The core executor function signature
export type ToolExecutor = (
  tool: ToolWithExecution,
  toolCall: ToolCall,
  execCtx: ToolExecutionContext,
) => Promise<AgentToolResult>;

// Middleware wraps an executor and returns a new executor
export type ToolExecutionMiddleware = (next: ToolExecutor) => ToolExecutor;
