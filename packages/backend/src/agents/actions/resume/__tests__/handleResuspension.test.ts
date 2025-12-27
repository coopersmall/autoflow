import { describe, expect, it } from 'bun:test';
import { AgentId, AgentRunId } from '@autoflow/core';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { ok } from 'neverthrow';
import { handleResuspension } from '../handleResuspension';
import {
  createAgentState,
  createMockDeps,
  createSuspendedResult,
  createSuspension,
  createSuspensionStack,
} from './fixtures';

describe('handleResuspension', () => {
  const ctx = createMockContext();

  it('should remove original stack from state by approvalId', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const originalStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    originalStack.leafSuspension = createSuspension({ approvalId: 'original' });

    const otherStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    otherStack.leafSuspension = createSuspension({ approvalId: 'other' });

    const savedState = createAgentState({
      suspensionStacks: [originalStack, otherStack],
    });

    const newStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const suspendedResult = createSuspendedResult([], [newStack]);

    await handleResuspension(
      ctx,
      savedState,
      originalStack,
      suspendedResult,
      deps,
    );

    const setCall = deps.stateCache.set.mock.calls[0];
    const updatedState = setCall[2];

    // Original stack removed, other stack preserved, new stack added
    expect(updatedState.suspensionStacks.length).toBe(2);
    expect(updatedState.suspensionStacks).toContain(otherStack);
    expect(updatedState.suspensionStacks).toContain(newStack);
    expect(updatedState.suspensionStacks).not.toContain(originalStack);
  });

  it('should add new stacks from suspendedResult', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const originalStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({
      suspensionStacks: [originalStack],
    });

    const newStack1 = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const newStack2 = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
      AgentId('agent-2'),
    ]);
    const suspendedResult = createSuspendedResult([], [newStack1, newStack2]);

    await handleResuspension(
      ctx,
      savedState,
      originalStack,
      suspendedResult,
      deps,
    );

    const setCall = deps.stateCache.set.mock.calls[0];
    const updatedState = setCall[2];

    expect(updatedState.suspensionStacks).toContain(newStack1);
    expect(updatedState.suspensionStacks).toContain(newStack2);
  });

  it('should save updated state to cache', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const stack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({
      id: AgentRunId('root-state-id'),
      suspensionStacks: [stack],
    });

    const suspendedResult = createSuspendedResult([], []);

    await handleResuspension(ctx, savedState, stack, suspendedResult, deps);

    expect(deps.stateCache.set).toHaveBeenCalledTimes(1);
    expect(deps.stateCache.set.mock.calls[0][1]).toBe(
      AgentRunId('root-state-id'),
    );
  });

  it('should return suspended status', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const stack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({ suspensionStacks: [stack] });
    const suspendedResult = createSuspendedResult([], []);

    const result = await handleResuspension(
      ctx,
      savedState,
      stack,
      suspendedResult,
      deps,
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().status).toBe('suspended');
  });

  it('should combine all suspensions correctly', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const ownSuspension = createSuspension({ approvalId: 'own' });
    const resultSuspension = createSuspension({ approvalId: 'result' });
    const otherStackSuspension = createSuspension({
      approvalId: 'other-stack',
    });

    const originalStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const otherStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    otherStack.leafSuspension = otherStackSuspension;

    const savedState = createAgentState({
      suspensions: [ownSuspension],
      suspensionStacks: [originalStack, otherStack],
    });

    const suspendedResult = createSuspendedResult([resultSuspension], []);

    const result = await handleResuspension(
      ctx,
      savedState,
      originalStack,
      suspendedResult,
      deps,
    );

    const res = result._unsafeUnwrap();

    if (res.status !== 'suspended') {
      throw new Error('Expected suspended status');
    }

    const suspensions = res.suspensions;

    expect(suspensions).toContainEqual(ownSuspension);
    expect(suspensions).toContainEqual(resultSuspension);
    expect(suspensions).toContainEqual(otherStackSuspension);
  });

  it('should use savedState.id as runId', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const stack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({
      id: AgentRunId('my-root-id'),
      suspensionStacks: [stack],
    });

    const suspendedResult = createSuspendedResult([], []);

    const result = await handleResuspension(
      ctx,
      savedState,
      stack,
      suspendedResult,
      deps,
    );

    expect(result._unsafeUnwrap().runId).toBe(AgentRunId('my-root-id'));
  });
});
