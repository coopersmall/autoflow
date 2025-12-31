import type {
  AgentExecuteFunction,
  SubAgentMapperFunction,
} from '@core/domain/agents';

/**
 * Tool extension hooks - implement custom tool behavior.
 * These are NOT chained - manifest values are used directly.
 *
 * Uses Record instead of Map for cleaner caller syntax.
 * These are in the hooks section (not serializable anyway due to functions).
 */
export interface ToolExtensionHooks {
  /** Custom tool implementations by tool name */
  readonly toolExecutors?: Readonly<Record<string, AgentExecuteFunction>>;

  /** Sub-agent argument mappers by sub-agent name */
  readonly subAgentMappers?: Readonly<Record<string, SubAgentMapperFunction>>;
}
