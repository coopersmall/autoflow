import type { OnStepFinishFunction } from '../../ai/request/completions/hooks/onStepFinish/OnStepFinishFunction';
import type { PrepareStepFunction } from '../../ai/request/completions/hooks/prepareStep/PrepareStepFunction';
import type { AgentExecuteFunction } from '../tools/AgentExecuteFunction';
import type { SubAgentMapperFunction } from './SubAgentMapperFunction';

// Note: This is a TypeScript type only, not a Zod schema
// Functions cannot be validated with Zod

export interface AgentManifestHooks {
  // Reuses existing hook types from completions
  prepareStep?: PrepareStepFunction;
  onStepFinish?: OnStepFinishFunction;

  // Tool executors by tool name (uses AgentExecuteFunction, not ExecuteFunction)
  toolExecutors?: Map<string, AgentExecuteFunction>;

  // Sub-agent request mappers by sub-agent name
  subAgentMappers?: Map<string, SubAgentMapperFunction>;
}
