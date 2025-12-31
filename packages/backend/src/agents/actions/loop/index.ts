// Re-export domain types for convenience
export type {
  LoopResult,
  SuspendedBranch,
} from '@backend/agents/domain/execution';
// consumeGenerator moved to ../utils
export { consumeGenerator } from '../utils/consumeGenerator';
export { buildAgentRunResult } from './buildAgentRunResult';
export {
  type BuildSuspensionStacksParams,
  buildSuspensionStacks,
} from './buildSuspensionStacks';
export {
  type ExecuteAgentDeps,
  type ExecuteAgentParams,
  executeAgent,
} from './executeAgent';
export {
  type ExecuteAgentLoopDeps,
  type ExecuteAgentLoopParams,
  executeAgentLoop,
} from './executeAgentLoop';
export {
  type ExecuteToolCallsParams,
  executeToolCalls,
} from './executeToolCalls';
export {
  type HandleOutputValidationParams,
  type HandleOutputValidationResult,
  handleOutputValidation,
} from './handleOutputValidation';
export {
  type StreamExecuteToolCallsParams,
  streamExecuteToolCalls,
} from './streamExecuteToolCalls';
export {
  buildToolCallResults,
  type CompletedToolCallResult,
  type ExecuteToolCallsResult,
  type SuspendedToolCallResult,
  type ToolCallResult,
  type UnknownToolCallResult,
} from './toolCallResult';
export {
  type UnifiedAgentLoopParams,
  unifiedAgentLoop,
} from './unifiedAgentLoop';
