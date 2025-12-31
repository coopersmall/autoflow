import { describe, expect, it } from 'bun:test';
import { AgentId, AgentRunId } from '@autoflow/core';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { ok } from 'neverthrow';
import { handleIntermediateParentStillSuspended } from '../handleIntermediateParentStillSuspended';
import {
  createAgentState,
  createMockDeps,
  createSuspension,
  createSuspensionStack,
  createSuspensionStackEntry,
} from './fixtures';

describe('handleIntermediateParentStillSuspended', () => {
  const ctx = createMockContext();

  it('should re-root parent existing stacks by prepending pathToParent', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const pathToParent = [
      createSuspensionStackEntry({
        manifestId: AgentId('root'),
        stateId: AgentRunId('root-state'),
      }),
      createSuspensionStackEntry({
        manifestId: AgentId('intermediate'),
        stateId: AgentRunId('intermediate-state'),
      }),
    ];

    const parentEntry = pathToParent[1];

    const parentChildStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const updatedParentState = createAgentState({
      suspensionStacks: [parentChildStack],
      suspensions: [],
    });

    const matchingStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({
      suspensionStacks: [matchingStack],
    });

    await handleIntermediateParentStillSuspended(
      ctx,
      savedState,
      matchingStack,
      pathToParent,
      parentEntry,
      updatedParentState,
      deps,
    );

    const setCall = deps.stateCache.set.mock.calls[0];
    const updatedRootState = setCall[2];

    const reRootedStack = updatedRootState.suspensionStacks.find(
      (s) => s.leafSuspension === parentChildStack.leafSuspension,
    );

    expect(reRootedStack).toBeDefined();
    expect(reRootedStack!.agents[0]).toBe(pathToParent[0]);
    expect(reRootedStack!.agents[1]).toBe(pathToParent[1]);
  });

  it('should build stacks for parent own HITL suspensions', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const pathToParent = [
      createSuspensionStackEntry({
        manifestId: AgentId('root'),
      }),
    ];
    const parentEntry = createSuspensionStackEntry({
      manifestId: AgentId('parent'),
      stateId: AgentRunId('parent-state'),
    });

    const directSuspension = createSuspension({ approvalId: 'direct' });
    const updatedParentState = createAgentState({
      suspensions: [directSuspension],
      suspensionStacks: [],
    });

    const matchingStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({
      suspensionStacks: [matchingStack],
    });

    await handleIntermediateParentStillSuspended(
      ctx,
      savedState,
      matchingStack,
      pathToParent,
      parentEntry,
      updatedParentState,
      deps,
    );

    const setCall = deps.stateCache.set.mock.calls[0];
    const updatedRootState = setCall[2];

    const directStack = updatedRootState.suspensionStacks.find(
      (s) => s.leafSuspension.approvalId === 'direct',
    );

    expect(directStack).toBeDefined();
    expect(directStack!.agents.length).toBe(2); // pathToParent + parent
    expect(directStack!.agents[directStack!.agents.length - 1].stateId).toBe(
      AgentRunId('parent-state'),
    );
  });

  it('should exclude already-stacked parent suspensions', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const pathToParent = [createSuspensionStackEntry()];
    const parentEntry = createSuspensionStackEntry({
      stateId: AgentRunId('parent-state'),
    });

    const suspension = createSuspension({ approvalId: 'same' });
    const childStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    childStack.leafSuspension = suspension;

    const updatedParentState = createAgentState({
      suspensions: [suspension],
      suspensionStacks: [childStack],
    });

    const matchingStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({
      suspensionStacks: [matchingStack],
    });

    await handleIntermediateParentStillSuspended(
      ctx,
      savedState,
      matchingStack,
      pathToParent,
      parentEntry,
      updatedParentState,
      deps,
    );

    const setCall = deps.stateCache.set.mock.calls[0];
    const updatedRootState = setCall[2];

    // Should only have 1 stack (re-rooted), not 2 (re-rooted + duplicate direct)
    const stacksWithSameSuspension = updatedRootState.suspensionStacks.filter(
      (s) => s.leafSuspension.approvalId === 'same',
    );

    expect(stacksWithSameSuspension.length).toBe(1);
  });

  it('should update root state to remove completed stack and add re-rooted stacks', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const pathToParent = [createSuspensionStackEntry()];
    const parentEntry = createSuspensionStackEntry();

    const matchingStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    matchingStack.leafSuspension = createSuspension({
      approvalId: 'completed',
    });

    const otherStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    otherStack.leafSuspension = createSuspension({ approvalId: 'other' });

    const savedState = createAgentState({
      suspensionStacks: [matchingStack, otherStack],
    });

    const parentStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const updatedParentState = createAgentState({
      suspensionStacks: [parentStack],
      suspensions: [],
    });

    await handleIntermediateParentStillSuspended(
      ctx,
      savedState,
      matchingStack,
      pathToParent,
      parentEntry,
      updatedParentState,
      deps,
    );

    const setCall = deps.stateCache.set.mock.calls[0];
    const updatedRootState = setCall[2];

    // Completed stack removed
    expect(
      updatedRootState.suspensionStacks.find(
        (s) => s.leafSuspension.approvalId === 'completed',
      ),
    ).toBeUndefined();

    // Other stack preserved
    expect(updatedRootState.suspensionStacks).toContain(otherStack);

    // Re-rooted parent stack added
    expect(
      updatedRootState.suspensionStacks.find(
        (s) => s.leafSuspension === parentStack.leafSuspension,
      ),
    ).toBeDefined();
  });

  it('should save root state to cache', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const pathToParent = [createSuspensionStackEntry()];
    const parentEntry = createSuspensionStackEntry();

    const matchingStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({
      id: AgentRunId('root-state-id'),
      suspensionStacks: [matchingStack],
    });

    const updatedParentState = createAgentState({
      suspensionStacks: [],
      suspensions: [createSuspension()],
    });

    await handleIntermediateParentStillSuspended(
      ctx,
      savedState,
      matchingStack,
      pathToParent,
      parentEntry,
      updatedParentState,
      deps,
    );

    expect(deps.stateCache.set).toHaveBeenCalledTimes(1);
    expect(deps.stateCache.set.mock.calls[0][1]).toBe(
      AgentRunId('root-state-id'),
    );
  });

  it('should return suspended status', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const pathToParent = [createSuspensionStackEntry()];
    const parentEntry = createSuspensionStackEntry();

    const matchingStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({
      suspensionStacks: [matchingStack],
    });

    const updatedParentState = createAgentState({
      suspensionStacks: [],
      suspensions: [createSuspension()],
    });

    const result = await handleIntermediateParentStillSuspended(
      ctx,
      savedState,
      matchingStack,
      pathToParent,
      parentEntry,
      updatedParentState,
      deps,
    );

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().status).toBe('suspended');
  });

  it('should combine all suspensions correctly', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const rootSuspension = createSuspension({ approvalId: 'root' });
    const parentSuspension = createSuspension({ approvalId: 'parent' });
    const reRootedSuspension = createSuspension({ approvalId: 're-rooted' });
    const remainingSuspension = createSuspension({ approvalId: 'remaining' });

    const pathToParent = [createSuspensionStackEntry()];
    const parentEntry = createSuspensionStackEntry();

    const matchingStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const remainingStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    remainingStack.leafSuspension = remainingSuspension;

    const savedState = createAgentState({
      suspensions: [rootSuspension],
      suspensionStacks: [matchingStack, remainingStack],
    });

    const parentChildStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    parentChildStack.leafSuspension = reRootedSuspension;

    const updatedParentState = createAgentState({
      suspensions: [parentSuspension],
      suspensionStacks: [parentChildStack],
    });

    const result = await handleIntermediateParentStillSuspended(
      ctx,
      savedState,
      matchingStack,
      pathToParent,
      parentEntry,
      updatedParentState,
      deps,
    );

    const res = result._unsafeUnwrap();

    if (res.status !== 'suspended') {
      throw new Error('Expected status to be suspended');
    }

    const suspensions = res.suspensions;

    expect(suspensions).toContainEqual(rootSuspension);
    expect(suspensions).toContainEqual(parentSuspension);
    expect(suspensions).toContainEqual(reRootedSuspension);
    expect(suspensions).toContainEqual(remainingSuspension);
  });

  it('should use savedState.id as runId', async () => {
    const deps = createMockDeps();
    deps.stateCache.set.mockResolvedValue(ok(undefined));

    const pathToParent = [createSuspensionStackEntry()];
    const parentEntry = createSuspensionStackEntry();

    const matchingStack = createSuspensionStack([
      AgentId('agent-0'),
      AgentId('agent-1'),
    ]);
    const savedState = createAgentState({
      id: AgentRunId('my-root-id'),
      suspensionStacks: [matchingStack],
    });

    const updatedParentState = createAgentState({
      suspensions: [createSuspension()],
      suspensionStacks: [],
    });

    const result = await handleIntermediateParentStillSuspended(
      ctx,
      savedState,
      matchingStack,
      pathToParent,
      parentEntry,
      updatedParentState,
      deps,
    );

    expect(result._unsafeUnwrap().runId).toBe(AgentRunId('my-root-id'));
  });
});
