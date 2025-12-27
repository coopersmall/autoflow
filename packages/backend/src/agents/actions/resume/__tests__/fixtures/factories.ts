import type { AgentState } from '@backend/agents/domain';
import type {
  AgentManifest,
  AgentRunResult,
  ContinueResponse,
  Suspension,
  SuspensionStack,
  SuspensionStackEntry,
} from '@core/domain/agents';
import { AgentId, AgentRunId } from '@core/domain/agents';
import { nanoid } from 'nanoid';

/**
 * Creates a suspension stack entry with sensible defaults.
 */
export function createSuspensionStackEntry(
  overrides?: Partial<SuspensionStackEntry>,
): SuspensionStackEntry {
  return {
    manifestId: AgentId('test-agent'),
    manifestVersion: '1.0.0',
    stateId: AgentRunId(),
    pendingToolCallId: `tool-call-${nanoid()}`,
    ...overrides,
  };
}

/**
 * Creates a suspension (tool approval request).
 */
export function createSuspension(overrides?: Partial<Suspension>): Suspension {
  return {
    type: 'tool-approval',
    approvalId: nanoid(),
    toolName: 'test-tool',
    toolArgs: {},
    description: 'Test suspension',
    ...overrides,
  };
}

/**
 * Creates a suspension stack with specified depth.
 * All entries except the last (leaf) have pendingToolCallId.
 */
export function createSuspensionStack(
  // depth: number,
  ids: AgentId[],
  overrides?: Partial<SuspensionStack>,
): SuspensionStack {
  if (ids.length < 2) {
    throw new Error('Stack depth must be at least 2');
  }

  const agents: SuspensionStackEntry[] = [];

  // Parent entries (have pendingToolCallId)
  for (const id of ids.slice(0, -1)) {
    agents.push(
      createSuspensionStackEntry({
        manifestId: id,
        manifestVersion: '1.0.0',
      }),
    );
  }

  // Leaf entry (no pendingToolCallId)
  const id = ids[ids.length - 1];
  agents.push(
    createSuspensionStackEntry({
      manifestId: id,
      manifestVersion: '1.0.0',
      pendingToolCallId: undefined,
    }),
  );

  return {
    agents,
    leafSuspension: createSuspension(),
    ...overrides,
  };
}

/**
 * Creates a minimal agent manifest for testing.
 */
export function createAgentManifest(
  id: string,
  version: string,
): AgentManifest {
  return {
    config: {
      id: AgentId(id),
      version,
      name: `Test Agent ${id}`,
      description: 'Test agent for unit tests',
      provider: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        settings: {},
      },
      instructions: 'You are a test agent.',
      onTextOnly: 'continue',
    },
    hooks: {},
  };
}

/**
 * Creates an agent state with sensible defaults.
 */
export function createAgentState(overrides?: Partial<AgentState>): AgentState {
  const now = new Date();
  return {
    id: AgentRunId(),
    rootManifestId: AgentId('root-agent'),
    manifestId: AgentId('test-agent'),
    manifestVersion: '1.0.0',
    messages: [],
    steps: [],
    currentStepNumber: 0,
    suspensions: [],
    suspensionStacks: [],
    pendingToolResults: [],
    status: 'suspended',
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    elapsedExecutionMs: 0,
    childStateIds: [],
    ...overrides,
  };
}

/**
 * Creates a continue response (approval).
 */
export function createContinueResponse(
  approvalId: string,
  approved = true,
): ContinueResponse {
  return {
    type: 'approval',
    approvalId,
    approved,
    reason: approved ? undefined : 'Denied by user',
  };
}

/**
 * Creates a complete agent run result.
 */
export function createCompleteResult(
  runId?: string,
): Extract<AgentRunResult, { status: 'complete' }> {
  return {
    status: 'complete',
    result: {
      manifestId: AgentId('test-agent'),
      status: 'complete',
      text: 'Task completed successfully',
      output: { success: true },
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      steps: [],
      finishReason: 'stop',
      totalUsage: {},
    },
    runId: AgentRunId(runId) ?? AgentRunId(),
  };
}

/**
 * Creates a suspended agent run result.
 */
export function createSuspendedResult(
  suspensions: Suspension[],
  suspensionStacks: SuspensionStack[] = [],
  runId?: string,
): Extract<AgentRunResult, { status: 'suspended' }> {
  return {
    status: 'suspended',
    suspensions,
    suspensionStacks,
    runId: AgentRunId(runId) ?? AgentRunId(),
  };
}

/**
 * Creates an error agent run result.
 */
export function createErrorResult(
  message: string,
  runId?: string,
): Extract<AgentRunResult, { status: 'error' }> {
  return {
    status: 'error',
    error: {
      message,
      code: 'InternalServer',
      name: 'TestError',
      metadata: {},
    },
    runId: AgentRunId(runId) ?? AgentRunId(),
  };
}

/**
 * Creates a manifest map from an array of manifests.
 */
export function createManifestMap(
  manifests: AgentManifest[],
): Map<string, AgentManifest> {
  const map = new Map<string, AgentManifest>();
  for (const manifest of manifests) {
    const key = `${manifest.config.id}:${manifest.config.version}`;
    map.set(key, manifest);
  }
  return map;
}
