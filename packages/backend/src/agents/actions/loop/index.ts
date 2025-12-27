// Re-export domain types for backwards compatibility
// UnifiedLoopResult renamed to LoopResult in domain
export type {
  LoopResult as AgentLoopResult,
  LoopResult as UnifiedLoopResult,
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
  type ExecuteAgentLoopDeps,
  type ExecuteAgentLoopParams,
  executeAgentLoop,
} from './executeAgentLoop';
export {
  type ExecuteToolCallsParams,
  type ExecuteToolCallsResult,
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
  type UnifiedAgentLoopDeps,
  type UnifiedAgentLoopParams,
  unifiedAgentLoop,
} from './unifiedAgentLoop';
