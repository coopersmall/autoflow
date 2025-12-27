import { describe, expect, it } from 'bun:test';
import { AgentId, AgentRunId } from '@autoflow/core';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { ok } from 'neverthrow';
import { handleCompletion } from '../handleCompletion';
import {
  createAgentManifest,
  createAgentState,
  createCompleteResult,
  createManifestMap,
  createMockDeps,
  createMockStreamAgent,
  createSuspension,
  createSuspensionStack,
} from './fixtures';

describe('handleCompletion', () => {
  const ctx = createMockContext();

  it('should add tool result to pendingToolResults', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const manifest = createAgentManifest('root', '1.0.0');
    const manifestMap = createManifestMap([manifest]);

    const stack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({
      pendingToolResults: [],
      suspensionStacks: [stack],
      suspensions: [],
    });

    const toolResult = {
      type: 'tool-result' as const,
      toolCallId: 'tool-1',
      toolName: 'test',
      output: { type: 'json' as const, value: '{}' },
      isError: false,
    };

    const streamAgentMock = createMockStreamAgent(createCompleteResult());

    await handleCompletion(
      ctx,
      manifest,
      manifestMap,
      savedState,
      stack,
      toolResult,
      deps,
      { streamAgent: streamAgentMock },
    );

    const setCall = deps.stateCache.set.mock.calls[0];
    const updatedState = setCall[2];

    expect(updatedState.pendingToolResults).toContain(toolResult);
  });

  it('should remove completed stack from suspensionStacks', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const manifest = createAgentManifest('root', '1.0.0');
    const manifestMap = createManifestMap([manifest]);

    const completedStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    completedStack.leafSuspension = createSuspension({
      approvalId: 'completed',
    });

    const otherStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    otherStack.leafSuspension = createSuspension({ approvalId: 'other' });

    const savedState = createAgentState({
      suspensionStacks: [completedStack, otherStack],
      suspensions: [],
    });

    const toolResult = {
      type: 'tool-result' as const,
      toolCallId: 'tool-1',
      toolName: 'test',
      output: { type: 'json' as const, value: '{}' },
      isError: false,
    };

    const streamAgentMock = createMockStreamAgent(createCompleteResult());

    await handleCompletion(
      ctx,
      manifest,
      manifestMap,
      savedState,
      completedStack,
      toolResult,
      deps,
      { streamAgent: streamAgentMock },
    );

    const setCall = deps.stateCache.set.mock.calls[0];
    const updatedState = setCall[2];

    expect(updatedState.suspensionStacks).not.toContain(completedStack);
    expect(updatedState.suspensionStacks).toContain(otherStack);
  });

  it('should save state before checking remaining suspensions', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const manifest = createAgentManifest('root', '1.0.0');
    const manifestMap = createManifestMap([manifest]);

    const stack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({
      suspensionStacks: [stack],
      suspensions: [],
    });

    const toolResult = {
      type: 'tool-result' as const,
      toolCallId: 'tool-1',
      toolName: 'test',
      output: { type: 'json' as const, value: '{}' },
      isError: false,
    };

    const streamAgentMock = createMockStreamAgent(createCompleteResult());

    await handleCompletion(
      ctx,
      manifest,
      manifestMap,
      savedState,
      stack,
      toolResult,
      deps,
      { streamAgent: streamAgentMock },
    );

    // State should be saved
    expect(deps.stateCache.set).toHaveBeenCalledTimes(1);
  });

  it('should return suspended when other stacks remain', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const manifest = createAgentManifest('root', '1.0.0');
    const manifestMap = createManifestMap([manifest]);

    const completedStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const remainingStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);

    const savedState = createAgentState({
      suspensionStacks: [completedStack, remainingStack],
      suspensions: [],
    });

    const toolResult = {
      type: 'tool-result' as const,
      toolCallId: 'tool-1',
      toolName: 'test',
      output: { type: 'json' as const, value: '{}' },
      isError: false,
    };

    const result = await handleCompletion(
      ctx,
      manifest,
      manifestMap,
      savedState,
      completedStack,
      toolResult,
      deps,
      { streamAgent: createMockStreamAgent(createCompleteResult()) },
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().status).toBe('suspended');
  });

  it('should return suspended when own suspensions remain', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const manifest = createAgentManifest('root', '1.0.0');
    const manifestMap = createManifestMap([manifest]);

    const stack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const ownSuspension = createSuspension();

    const savedState = createAgentState({
      suspensionStacks: [stack],
      suspensions: [ownSuspension],
    });

    const toolResult = {
      type: 'tool-result' as const,
      toolCallId: 'tool-1',
      toolName: 'test',
      output: { type: 'json' as const, value: '{}' },
      isError: false,
    };

    const result = await handleCompletion(
      ctx,
      manifest,
      manifestMap,
      savedState,
      stack,
      toolResult,
      deps,
      { streamAgent: createMockStreamAgent(createCompleteResult()) },
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().status).toBe('suspended');
  });

  it('should call runAgent with continue when all suspensions resolved', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const manifest = createAgentManifest('root', '1.0.0');
    const manifestMap = createManifestMap([manifest]);

    const stack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({
      id: AgentRunId('root-id'),
      suspensionStacks: [stack],
      suspensions: [],
    });

    const toolResult = {
      type: 'tool-result' as const,
      toolCallId: 'tool-1',
      toolName: 'test',
      output: { type: 'json' as const, value: '{}' },
      isError: false,
    };

    const streamAgentMock = createMockStreamAgent(createCompleteResult());

    await handleCompletion(
      ctx,
      manifest,
      manifestMap,
      savedState,
      stack,
      toolResult,
      deps,
      { streamAgent: streamAgentMock },
    );

    expect(streamAgentMock).toHaveBeenCalledTimes(1);
    const call = streamAgentMock.mock.calls[0];
    expect(call[2].type).toBe('continue');
    expect(call[2].runId).toBe('root-id');
  });

  it('should use savedState.id as runId in suspended result', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const manifest = createAgentManifest('root', '1.0.0');
    const manifestMap = createManifestMap([manifest]);

    const stack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const otherStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);

    const savedState = createAgentState({
      id: AgentRunId('my-root-id'),
      suspensionStacks: [stack, otherStack],
      suspensions: [],
    });

    const toolResult = {
      type: 'tool-result' as const,
      toolCallId: 'tool-1',
      toolName: 'test',
      output: { type: 'json' as const, value: '{}' },
      isError: false,
    };

    const result = await handleCompletion(
      ctx,
      manifest,
      manifestMap,
      savedState,
      stack,
      toolResult,
      deps,
      { streamAgent: createMockStreamAgent(createCompleteResult()) },
    );

    expect(result._unsafeUnwrap().runId).toBe(AgentRunId('my-root-id'));
  });

  it('should combine suspensions correctly in suspended result', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const manifest = createAgentManifest('root', '1.0.0');
    const manifestMap = createManifestMap([manifest]);

    const ownSuspension = createSuspension({ approvalId: 'own' });
    const stackSuspension = createSuspension({ approvalId: 'stack' });

    const completedStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const remainingStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    remainingStack.leafSuspension = stackSuspension;

    const savedState = createAgentState({
      suspensionStacks: [completedStack, remainingStack],
      suspensions: [ownSuspension],
    });

    const toolResult = {
      type: 'tool-result' as const,
      toolCallId: 'tool-1',
      toolName: 'test',
      output: { type: 'json' as const, value: '{}' },
      isError: false,
    };

    const result = await handleCompletion(
      ctx,
      manifest,
      manifestMap,
      savedState,
      completedStack,
      toolResult,
      deps,
      { streamAgent: createMockStreamAgent(createCompleteResult()) },
    );

    const res = result._unsafeUnwrap();

    if (res.status !== 'suspended') {
      throw new Error('Expected result to be suspended');
    }

    const suspensions = res.suspensions;
    expect(suspensions).toContainEqual(ownSuspension);
    expect(suspensions).toContainEqual(stackSuspension);
  });
});
