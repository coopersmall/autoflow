# Integration Test Plan: Agent Cancellation & Running State

## Overview

End-to-end integration tests for the agent cancellation and running state features using `orchestrateAgentRun` as the entry point. Tests use real Redis/PostgreSQL infrastructure with mocked `completionsGateway` for controlled inputs.

## Key Decisions

| Aspect | Decision |
|--------|----------|
| StateId capture | Use `agent-started` event (newly added, emits stateId immediately) |
| Sub-agent tests | Explicit tests for 6 recursive scenarios |
| Parallel execution | `describe.concurrent` + `it.concurrent` for property tests |
| Property test runs | 15 runs per property, split across concurrent test blocks |

## Test Configuration

```typescript
const TEST_CONFIG = {
  cancellationPollIntervalMs: 50,  // Fast polling for tests
  agentRunLockTtl: 2,              // 2 seconds for crash detection tests
};
```

## Test File Structure

```
packages/backend/src/agents/actions/__tests__/
├── cancellation.integration.test.ts        # Core cancellation tests
├── cancellationSubAgent.integration.test.ts # Sub-agent recursive scenarios
├── fixtures/
│   ├── index.ts
│   ├── factories.ts                        # Existing + new factories
│   ├── arbitraries.ts                      # Existing + new arbitraries
│   └── helpers.ts                          # New test helpers
```

---

## File 1: `cancellation.integration.test.ts`

### Setup

```typescript
import { describe, expect, it } from 'bun:test';
import * as fc from 'fast-check';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { createAgentStateCache, createAgentCancellationCache } from '@backend/agents/infrastructure/cache';
import { createAgentRunLock } from '@backend/agents/infrastructure/lock';
import { orchestrateAgentRun } from '../orchestrateAgentRun';
import { cancelAgentState } from '../state/cancelAgentState';
import { signalCancellation } from '../cancellation';

describe('Agent Cancellation Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  const setup = () => {
    const config = getConfig();
    const logger = getLogger();
    
    // Real infrastructure
    const stateCache = createAgentStateCache({ appConfig: config, logger });
    const cancellationCache = createAgentCancellationCache({ appConfig: config, logger });
    const agentRunLock = createAgentRunLock({ appConfig: config, logger, ttl: 2 });
    const storageService = createStorageService({ ... });
    
    // Mocked
    const completionsGateway = getMockedCompletionsGateway();
    const mcpService = getMockedMCPService();
    
    return { 
      deps: { stateCache, cancellationCache, agentRunLock, storageService, completionsGateway, mcpService, logger },
      stateCache, 
      cancellationCache, 
      agentRunLock 
    };
  };
});
```

---

### Test Group 1: Cancel Suspended Agent

#### Test 1.1: Cancel suspended agent marks state as cancelled

```typescript
it('should mark suspended agent as cancelled', async () => {
  const { deps, stateCache } = setup();
  const ctx = createMockContext();
  const manifest = createTestManifest('test-agent', {
    tools: [createApprovalRequiredTool('dangerous-tool')],
  });

  deps.completionsGateway.streamCompletion.mockImplementation(
    createMockStreamCompletion(createToolApprovalParts('approval-1', 'dangerous-tool', {})),
  );

  const generator = orchestrateAgentRun(ctx, manifest, {
    type: 'request',
    prompt: 'Do something dangerous',
    manifestMap: new Map(),
    options: { cancellationPollIntervalMs: 50 },
  }, deps);

  const { finalResult } = await collectStreamItems(generator);
  const result = assertFinalResultOk(finalResult);
  expect(result.status).toBe('suspended');
  const stateId = result.runId;

  const cancelResult = await cancelAgentState(ctx, stateId, deps);
  
  expect(cancelResult.isOk()).toBe(true);
  expect(cancelResult._unsafeUnwrap().type).toBe('marked-cancelled');

  const stateResult = await stateCache.get(ctx, stateId);
  expect(stateResult._unsafeUnwrap().status).toBe('cancelled');
});
```

#### Test 1.2: Property - Any suspended agent can be cancelled

```typescript
describe.concurrent('Cancellation Properties', () => {
  it.concurrent('should cancel any suspended agent (property)', async () => {
    await fc.assert(
      fc.asyncProperty(
        approvalToolArb,
        promptArb,
        async (tool, prompt) => {
          const { deps, stateCache } = setup();
          const ctx = createMockContext();
          const manifest = createTestManifest('prop-agent', { tools: [tool] });

          deps.completionsGateway.streamCompletion.mockImplementation(
            createMockStreamCompletion(createToolApprovalParts('approval-1', tool.function.name, {})),
          );

          const generator = orchestrateAgentRun(ctx, manifest, {
            type: 'request',
            prompt,
            manifestMap: new Map(),
          }, deps);

          const { finalResult } = await collectStreamItems(generator);
          const result = finalResult!.result._unsafeUnwrap();
          
          if (result.status !== 'suspended') return;
          
          const cancelResult = await cancelAgentState(ctx, result.runId, deps);
          expect(cancelResult.isOk()).toBe(true);
          expect(cancelResult._unsafeUnwrap().type).toBe('marked-cancelled');
        },
      ),
      { numRuns: 15 },
    );
  });
});
```

---

### Test Group 2: Cancel Running Agent

#### Test 2.1: Cancel running agent via signal (using agent-started event)

```typescript
it('should signal cancellation and agent should yield agent-cancelled event', async () => {
  const { deps, cancellationCache } = setup();
  const ctx = createMockContext();
  const manifest = createTestManifest('test-agent');

  deps.completionsGateway.streamCompletion.mockImplementation(
    createSlowCompletionMock(500, createTextCompletionParts('Hello')),
  );

  const generator = orchestrateAgentRun(ctx, manifest, {
    type: 'request',
    prompt: 'Say hello slowly',
    manifestMap: new Map(),
    options: { cancellationPollIntervalMs: 50 },
  }, deps);

  // Get agent-started event to capture stateId
  const firstResult = await generator.next();
  expect(firstResult.done).toBe(false);
  
  const startedEvent = firstResult.value;
  expect(startedEvent.isOk()).toBe(true);
  expect(startedEvent._unsafeUnwrap().type).toBe('agent-started');
  const stateId = (startedEvent._unsafeUnwrap() as AgentStartedEvent).stateId;

  // Signal cancellation
  await signalCancellation(ctx, stateId, deps);

  // Collect remaining items
  const { events, finalResult } = await collectRemainingItems(generator);

  // Should have agent-cancelled event
  const cancelledEvents = events.filter(e => e.type === 'agent-cancelled');
  expect(cancelledEvents.length).toBe(1);

  // Final result should be cancelled
  const result = assertFinalResultOk(finalResult);
  expect(result.status).toBe('cancelled');
});
```

#### Test 2.2: Property - Cancellation at any point results in cancelled state

```typescript
describe.concurrent('Running Agent Cancellation Properties', () => {
  it.concurrent('cancellation timing property - early cancel', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 100 }),   // cancelAfterMs (early)
        fc.integer({ min: 200, max: 400 }),  // completionDelayMs
        async (cancelAfterMs, completionDelayMs) => {
          const { deps, stateCache } = setup();
          const ctx = createMockContext();
          const manifest = createTestManifest('prop-agent');

          deps.completionsGateway.streamCompletion.mockImplementation(
            createSlowCompletionMock(completionDelayMs, createTextCompletionParts('Done')),
          );

          const generator = orchestrateAgentRun(ctx, manifest, {
            type: 'request',
            prompt: 'Work',
            manifestMap: new Map(),
            options: { cancellationPollIntervalMs: 20 },
          }, deps);

          // Get stateId from agent-started event
          const firstResult = await generator.next();
          const stateId = extractStateIdFromStartedEvent(firstResult.value);

          // Cancel after delay
          setTimeout(() => signalCancellation(ctx, stateId, deps), cancelAfterMs);

          const { finalResult } = await collectRemainingItems(generator);
          const result = finalResult!.result;

          if (result.isOk()) {
            expect(['complete', 'cancelled']).toContain(result.value.status);
          }
        },
      ),
      { numRuns: 15 },
    );
  });

  it.concurrent('cancellation timing property - late cancel', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 150, max: 300 }),  // cancelAfterMs (late)
        fc.integer({ min: 100, max: 200 }),  // completionDelayMs
        async (cancelAfterMs, completionDelayMs) => {
          // Similar test but cancel comes after completion starts
          // Verifies agent completes normally if cancel is too late
        },
      ),
      { numRuns: 15 },
    );
  });
});
```

#### Test 2.3: Tool execution respects abort signal

```typescript
it('should abort tool execution when cancelled', async () => {
  const { deps } = setup();
  const ctx = createMockContext();
  
  let toolWasAborted = false;
  const slowTool: AgentExecuteFunction = async (toolCtx) => {
    for (let i = 0; i < 10; i++) {
      if (toolCtx.signal.aborted) {
        toolWasAborted = true;
        throw new Error('Aborted');
      }
      await delay(50);
    }
    return { type: 'success', output: { done: true } };
  };

  const manifest = createTestManifest('test-agent', {
    tools: [createTool('slow-tool')],
    toolExecutors: new Map([['slow-tool', slowTool]]),
  });

  deps.completionsGateway.streamCompletion.mockImplementation(
    createMockStreamCompletion(createToolCallCompletionParts('slow-tool', 'call-1', {})),
  );

  const generator = orchestrateAgentRun(ctx, manifest, {
    type: 'request',
    prompt: 'Use slow tool',
    manifestMap: new Map(),
    options: { cancellationPollIntervalMs: 50 },
  }, deps);

  // Get stateId from agent-started
  const first = await generator.next();
  const stateId = extractStateIdFromStartedEvent(first.value);
  
  // Cancel after tool starts
  setTimeout(() => signalCancellation(ctx, stateId, deps), 100);

  const { finalResult } = await collectRemainingItems(generator);
  
  expect(toolWasAborted).toBe(true);
  expect(finalResult!.result._unsafeUnwrap().status).toBe('cancelled');
});
```

---

### Test Group 3: Idempotency and Error Cases

#### Test 3.1: Cancel already-cancelled agent is idempotent

```typescript
it('should return already-cancelled for cancelled agent', async () => {
  // ... suspend then cancel an agent ...
  
  const secondCancel = await cancelAgentState(ctx, stateId, deps);
  
  expect(secondCancel.isOk()).toBe(true);
  expect(secondCancel._unsafeUnwrap().type).toBe('already-cancelled');
});
```

#### Test 3.2: Cannot cancel completed agent

```typescript
it('should return error when cancelling completed agent', async () => {
  // ... run agent to completion ...
  
  const cancelResult = await cancelAgentState(ctx, result.runId, deps);
  
  expect(cancelResult.isErr()).toBe(true);
  expect(cancelResult._unsafeUnwrapErr().message).toContain('terminal state');
});
```

#### Test 3.3: Cannot cancel failed agent

```typescript
it('should return error when cancelling failed agent', async () => {
  // ... run agent that fails ...
  
  const cancelResult = await cancelAgentState(ctx, stateId, deps);
  
  expect(cancelResult.isErr()).toBe(true);
  expect(cancelResult._unsafeUnwrapErr().message).toContain('terminal state');
});
```

---

### Test Group 4: Concurrency & Lock Behavior

#### Test 4.1: Concurrent execution returns already-running

```typescript
it('should return already-running for concurrent execution attempts', async () => {
  const { deps } = setup();
  const ctx1 = createMockContext();
  const ctx2 = createMockContext();
  const manifest = createTestManifest('test-agent');

  deps.completionsGateway.streamCompletion.mockImplementation(
    createSlowCompletionMock(1000, createTextCompletionParts('Done')),
  );

  // Start first execution
  const gen1 = orchestrateAgentRun(ctx1, manifest, {
    type: 'request',
    prompt: 'First',
    manifestMap: new Map(),
  }, deps);

  // Get stateId from agent-started
  const firstEvent = await gen1.next();
  const stateId = extractStateIdFromStartedEvent(firstEvent.value);

  // Try to continue same agent from different context
  const gen2 = orchestrateAgentRun(ctx2, manifest, {
    type: 'continue',
    runId: stateId,
    manifestMap: new Map(),
  }, deps);

  const { finalResult: result2 } = await collectStreamItems(gen2);
  
  expect(result2!.result.isOk()).toBe(true);
  expect(result2!.result._unsafeUnwrap().status).toBe('already-running');

  // Cancel first to clean up
  await signalCancellation(ctx1, stateId, deps);
  await collectRemainingItems(gen1);
});
```

#### Test 4.2: Lock released after completion

```typescript
it('should release lock after normal completion allowing new run', async () => {
  const { deps, agentRunLock } = setup();
  const ctx = createMockContext();
  const manifest = createTestManifest('test-agent');

  deps.completionsGateway.streamCompletion.mockImplementation(
    createMockStreamCompletion(createTextCompletionParts('Done')),
  );

  // First run
  const gen1 = orchestrateAgentRun(ctx, manifest, {
    type: 'request',
    prompt: 'First run',
    manifestMap: new Map(),
  }, deps);

  const { events, finalResult: result1 } = await collectStreamItems(gen1);
  const startedEvent = events.find(e => e.type === 'agent-started');
  const stateId = (startedEvent as AgentStartedEvent).stateId;

  // Verify lock is NOT held
  const lockCheck = await agentRunLock.isLocked(ctx, stateId);
  expect(lockCheck._unsafeUnwrap()).toBe(false);

  // Can continue the same agent
  deps.completionsGateway.streamCompletion.mockImplementation(
    createMockStreamCompletion(createTextCompletionParts('Second run done')),
  );

  const gen2 = orchestrateAgentRun(ctx, manifest, {
    type: 'continue',
    runId: stateId,
    manifestMap: new Map(),
  }, deps);

  const { finalResult: result2 } = await collectStreamItems(gen2);
  expect(result2!.result.isOk()).toBe(true);
});
```

---

### Test Group 5: Crash Detection

#### Test 5.1: Detect crashed agent (lock acquired + duration > TTL)

```typescript
it('should mark agent as failed when crash detected', async () => {
  const { deps, stateCache } = setup();
  const ctx = createMockContext();

  const stateId = AgentRunId();
  const oldStartTime = new Date(Date.now() - 60_000); // 60 seconds ago
  
  await stateCache.set(ctx, stateId, {
    id: stateId,
    schemaVersion: 1,
    createdAt: oldStartTime,
    updatedAt: oldStartTime,
    startedAt: oldStartTime,
    status: 'running',
    messages: [],
    manifestId: AgentId('test-agent'),
    manifestVersion: '1.0.0',
  });

  const cancelResult = await cancelAgentState(ctx, stateId, deps, {
    agentRunLockTtl: 2,
  });

  expect(cancelResult.isOk()).toBe(true);
  expect(cancelResult._unsafeUnwrap().type).toBe('marked-failed');

  const state = await stateCache.get(ctx, stateId);
  expect(state._unsafeUnwrap().status).toBe('failed');
});
```

#### Test 5.2: Race condition - signals cancellation when duration <= TTL

```typescript
it('should signal cancellation in race condition scenario', async () => {
  const { deps, stateCache, cancellationCache } = setup();
  const ctx = createMockContext();

  const stateId = AgentRunId();
  const recentStart = new Date(Date.now() - 500);
  
  await stateCache.set(ctx, stateId, {
    id: stateId,
    schemaVersion: 1,
    createdAt: recentStart,
    updatedAt: recentStart,
    startedAt: recentStart,
    status: 'running',
    messages: [],
    manifestId: AgentId('test-agent'),
    manifestVersion: '1.0.0',
  });

  const cancelResult = await cancelAgentState(ctx, stateId, deps, {
    agentRunLockTtl: 2,
  });

  expect(cancelResult.isOk()).toBe(true);
  expect(cancelResult._unsafeUnwrap().type).toBe('signaled-running');

  const signal = await cancellationCache.get(ctx, stateId);
  expect(signal._unsafeUnwrap()).not.toBeNull();
});
```

---

### Test Group 6: Running State Management

#### Test 6.1: Fresh request creates running state with startedAt

```typescript
it('should create running state with startedAt on fresh request', async () => {
  const { deps, stateCache } = setup();
  const ctx = createMockContext();
  const manifest = createTestManifest('test-agent');
  const beforeRun = Date.now();

  deps.completionsGateway.streamCompletion.mockImplementation(
    createSlowCompletionMock(200, createTextCompletionParts('Hello')),
  );

  const generator = orchestrateAgentRun(ctx, manifest, {
    type: 'request',
    prompt: 'Hello',
    manifestMap: new Map(),
  }, deps);

  // Get agent-started event
  const firstResult = await generator.next();
  const stateId = extractStateIdFromStartedEvent(firstResult.value);
  
  // Check state was created with running status
  const state = await stateCache.get(ctx, stateId);
  const stateValue = state._unsafeUnwrap();
  
  expect(stateValue.status).toBe('running');
  expect(stateValue.startedAt).toBeDefined();
  expect(stateValue.startedAt!.getTime()).toBeGreaterThanOrEqual(beforeRun);

  // Clean up
  await signalCancellation(ctx, stateId, deps);
  await collectRemainingItems(generator);
});
```

#### Test 6.2: State finalized to completed on success

```typescript
it('should finalize state to completed on successful execution', async () => {
  const { deps, stateCache } = setup();
  const ctx = createMockContext();
  const manifest = createTestManifest('test-agent');

  deps.completionsGateway.streamCompletion.mockImplementation(
    createMockStreamCompletion(createTextCompletionParts('Complete!')),
  );

  const generator = orchestrateAgentRun(ctx, manifest, {
    type: 'request',
    prompt: 'Finish',
    manifestMap: new Map(),
  }, deps);

  const { events, finalResult } = await collectStreamItems(generator);
  const result = assertFinalResultOk(finalResult);
  
  const startedEvent = events.find(e => e.type === 'agent-started') as AgentStartedEvent;
  const state = await stateCache.get(ctx, startedEvent.stateId);
  const stateValue = state._unsafeUnwrap();

  expect(stateValue.status).toBe('completed');
  expect(stateValue.elapsedExecutionMs).toBeGreaterThan(0);
});
```

---

## File 2: `cancellationSubAgent.integration.test.ts`

### Sub-Agent Recursive Scenarios

All tests use `describe.concurrent` for parallel execution.

#### Test 7.1: Parent suspended + Child suspended → Cancel parent (recursive)

```typescript
describe.concurrent('Sub-Agent Recursive Cancellation', () => {
  it.concurrent('should cancel parent and child when both suspended', async () => {
    const { deps, stateCache } = setup();
    const ctx = createMockContext();
    
    const childManifest = createTestManifest('child-agent', {
      tools: [createApprovalRequiredTool('child-tool')],
    });
    const parentManifest = createTestManifest('parent-agent', {
      subAgents: [{ id: 'child-agent', version: '1.0.0' }],
    });
    const manifestMap = createManifestMap([childManifest, parentManifest]);

    // Mock: Parent calls child, child suspends
    deps.completionsGateway.streamCompletion
      .mockImplementationOnce(createMockStreamCompletion(
        createToolCallCompletionParts('child-agent', 'call-1', { prompt: 'child work' }),
      ))
      .mockImplementationOnce(createMockStreamCompletion(
        createToolApprovalParts('child-approval', 'child-tool', {}),
      ));

    const generator = orchestrateAgentRun(ctx, parentManifest, {
      type: 'request',
      prompt: 'Use child agent',
      manifestMap,
    }, deps);

    const { finalResult } = await collectStreamItems(generator);
    const result = assertFinalResultOk(finalResult);
    expect(result.status).toBe('suspended');
    const parentStateId = result.runId;

    // Cancel with recursive: true
    const cancelResult = await cancelAgentState(ctx, parentStateId, deps, { recursive: true });
    
    expect(cancelResult.isOk()).toBe(true);
    expect(cancelResult._unsafeUnwrap().type).toBe('marked-cancelled');

    // Verify parent is cancelled
    const parentState = await stateCache.get(ctx, parentStateId);
    expect(parentState._unsafeUnwrap().status).toBe('cancelled');

    // Verify child is also cancelled
    const childStateIds = extractChildStateIdsFromSuspensionStacks(parentState._unsafeUnwrap());
    for (const childId of childStateIds) {
      const childState = await stateCache.get(ctx, childId);
      expect(childState._unsafeUnwrap().status).toBe('cancelled');
    }
  });
});
```

#### Test 7.2: Parent running + Child running → Cancel parent

```typescript
it.concurrent('should abort both parent and child when parent cancelled during execution', async () => {
  const { deps } = setup();
  const ctx = createMockContext();
  
  let childToolAborted = false;
  const slowChildTool: AgentExecuteFunction = async (toolCtx) => {
    for (let i = 0; i < 20; i++) {
      if (toolCtx.signal.aborted) {
        childToolAborted = true;
        throw new Error('Aborted');
      }
      await delay(50);
    }
    return { type: 'success', output: {} };
  };
  
  const childManifest = createTestManifest('child-agent', {
    tools: [createTool('slow-child-tool')],
    toolExecutors: new Map([['slow-child-tool', slowChildTool]]),
  });
  const parentManifest = createTestManifest('parent-agent', {
    subAgents: [{ id: 'child-agent', version: '1.0.0' }],
  });
  const manifestMap = createManifestMap([childManifest, parentManifest]);

  // Mock: Parent calls child, child calls slow tool
  deps.completionsGateway.streamCompletion
    .mockImplementationOnce(createMockStreamCompletion(
      createToolCallCompletionParts('child-agent', 'call-1', { prompt: 'do slow work' }),
    ))
    .mockImplementationOnce(createMockStreamCompletion(
      createToolCallCompletionParts('slow-child-tool', 'call-2', {}),
    ));

  const generator = orchestrateAgentRun(ctx, parentManifest, {
    type: 'request',
    prompt: 'Use child',
    manifestMap,
    options: { cancellationPollIntervalMs: 50 },
  }, deps);

  // Get parent stateId
  const first = await generator.next();
  const parentStateId = extractStateIdFromStartedEvent(first.value);

  // Cancel after child tool starts
  setTimeout(() => signalCancellation(ctx, parentStateId, deps), 200);

  const { finalResult } = await collectRemainingItems(generator);
  
  expect(childToolAborted).toBe(true);
  expect(finalResult!.result._unsafeUnwrap().status).toBe('cancelled');
});
```

#### Test 7.3: Parent running + Child suspended → Cancel parent

```typescript
it.concurrent('should cancel parent and mark child cancelled when parent running, child suspended', async () => {
  // Parent is running (e.g., doing other work after child suspended)
  // Child is suspended waiting for approval
  // Cancel parent → parent aborts, child marked cancelled
});
```

#### Test 7.4: Parent suspended + Child running → Cancel parent (recursive)

```typescript
it.concurrent('should signal child cancellation when parent suspended but child somehow running', async () => {
  // Edge case: parent is suspended but child is actually running
  // This shouldn't normally happen, but tests defensive behavior
});
```

#### Test 7.5: Deeply nested (3+ levels) → Cancel root

```typescript
it.concurrent('should recursively cancel all levels in deep nesting', async () => {
  const { deps, stateCache } = setup();
  const ctx = createMockContext();

  // Create 3-level hierarchy: grandparent -> parent -> child
  const childManifest = createTestManifest('child-agent', {
    tools: [createApprovalRequiredTool('child-tool')],
  });
  const parentManifest = createTestManifest('parent-agent', {
    subAgents: [{ id: 'child-agent', version: '1.0.0' }],
  });
  const grandparentManifest = createTestManifest('grandparent-agent', {
    subAgents: [{ id: 'parent-agent', version: '1.0.0' }],
  });
  const manifestMap = createManifestMap([childManifest, parentManifest, grandparentManifest]);

  // Mock: grandparent -> parent -> child -> suspends
  deps.completionsGateway.streamCompletion
    .mockImplementationOnce(createMockStreamCompletion(
      createToolCallCompletionParts('parent-agent', 'call-1', { prompt: 'call parent' }),
    ))
    .mockImplementationOnce(createMockStreamCompletion(
      createToolCallCompletionParts('child-agent', 'call-2', { prompt: 'call child' }),
    ))
    .mockImplementationOnce(createMockStreamCompletion(
      createToolApprovalParts('approval-1', 'child-tool', {}),
    ));

  const generator = orchestrateAgentRun(ctx, grandparentManifest, {
    type: 'request',
    prompt: 'Start chain',
    manifestMap,
  }, deps);

  const { finalResult } = await collectStreamItems(generator);
  const result = assertFinalResultOk(finalResult);
  expect(result.status).toBe('suspended');
  const rootStateId = result.runId;

  // Cancel root with recursive: true
  await cancelAgentState(ctx, rootStateId, deps, { recursive: true });

  // Verify all levels cancelled
  // ... verify grandparent, parent, child all have status: 'cancelled'
});
```

#### Test 7.6: Parallel children → Cancel parent

```typescript
it.concurrent('should cancel all parallel children when parent cancelled', async () => {
  const { deps } = setup();
  const ctx = createMockContext();
  
  let child1Aborted = false;
  let child2Aborted = false;
  
  const slowTool1: AgentExecuteFunction = async (toolCtx) => {
    for (let i = 0; i < 10; i++) {
      if (toolCtx.signal.aborted) { child1Aborted = true; throw new Error('Aborted'); }
      await delay(50);
    }
    return { type: 'success', output: {} };
  };
  
  const slowTool2: AgentExecuteFunction = async (toolCtx) => {
    for (let i = 0; i < 10; i++) {
      if (toolCtx.signal.aborted) { child2Aborted = true; throw new Error('Aborted'); }
      await delay(50);
    }
    return { type: 'success', output: {} };
  };

  const child1Manifest = createTestManifest('child-1', {
    tools: [createTool('slow-1')],
    toolExecutors: new Map([['slow-1', slowTool1]]),
  });
  const child2Manifest = createTestManifest('child-2', {
    tools: [createTool('slow-2')],
    toolExecutors: new Map([['slow-2', slowTool2]]),
  });
  const parentManifest = createTestManifest('parent-agent', {
    subAgents: [
      { id: 'child-1', version: '1.0.0' },
      { id: 'child-2', version: '1.0.0' },
    ],
  });
  const manifestMap = createManifestMap([child1Manifest, child2Manifest, parentManifest]);

  // Mock: Parent calls both children in parallel (via parallel tool calls)
  deps.completionsGateway.streamCompletion.mockImplementationOnce(
    createMockStreamCompletion(createParallelToolCallParts([
      { name: 'child-1', id: 'call-1', input: { prompt: 'work 1' } },
      { name: 'child-2', id: 'call-2', input: { prompt: 'work 2' } },
    ])),
  );

  // Children call their slow tools
  deps.completionsGateway.streamCompletion
    .mockImplementationOnce(createMockStreamCompletion(
      createToolCallCompletionParts('slow-1', 'tool-1', {}),
    ))
    .mockImplementationOnce(createMockStreamCompletion(
      createToolCallCompletionParts('slow-2', 'tool-2', {}),
    ));

  const generator = orchestrateAgentRun(ctx, parentManifest, {
    type: 'request',
    prompt: 'Use both children',
    manifestMap,
    options: { cancellationPollIntervalMs: 50 },
  }, deps);

  const first = await generator.next();
  const parentStateId = extractStateIdFromStartedEvent(first.value);

  // Cancel after children start
  setTimeout(() => signalCancellation(ctx, parentStateId, deps), 150);

  const { finalResult } = await collectRemainingItems(generator);
  
  expect(child1Aborted).toBe(true);
  expect(child2Aborted).toBe(true);
  expect(finalResult!.result._unsafeUnwrap().status).toBe('cancelled');
});
```

---

## New Fixtures

### `fixtures/factories.ts` additions

```typescript
/**
 * Creates a tool that requires approval (causes suspension).
 */
export function createApprovalRequiredTool(name: string): Tool {
  return {
    type: 'function',
    function: {
      name,
      description: `Tool ${name} that requires approval`,
      parameters: { type: 'object', properties: {} },
    },
    approval: 'always',
  };
}

/**
 * Creates a slow completion mock that delays between parts.
 */
export function createSlowCompletionMock(
  delayMs: number,
  parts: StreamPart[],
): () => AsyncGenerator<Result<StreamPart, AppError>> {
  return async function* () {
    for (const part of parts) {
      await delay(delayMs / parts.length);
      yield ok(part);
    }
  };
}

/**
 * Creates a tool definition.
 */
export function createTool(name: string): Tool {
  return {
    type: 'function',
    function: {
      name,
      description: `Tool ${name}`,
      parameters: { type: 'object', properties: {} },
    },
  };
}

/**
 * Creates parallel tool call completion parts.
 */
export function createParallelToolCallParts(
  tools: Array<{ name: string; id: string; input: unknown }>,
): StreamPart[] {
  const now = new Date();
  const toolCalls = tools.map(t => ({
    type: 'tool-call' as const,
    toolCallId: t.id,
    toolName: t.name,
    input: t.input,
  }));
  
  return [
    { type: 'start' },
    { type: 'start-step', request: { body: undefined }, warnings: [] },
    ...toolCalls,
    {
      type: 'finish-step',
      response: { id: 'resp-1', timestamp: now, modelId: 'claude-3-5-sonnet-20241022' },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      finishReason: 'tool-calls',
    },
    {
      type: 'finish',
      finishReason: 'tool-calls',
      totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
  ];
}
```

### `fixtures/arbitraries.ts` additions

```typescript
/**
 * Arbitrary for approval-required tools.
 */
export const approvalToolArb = fc.record({
  type: fc.constant('function' as const),
  function: fc.record({
    name: fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/),
    description: fc.string({ minLength: 1, maxLength: 100 }),
    parameters: fc.constant({ type: 'object', properties: {} }),
  }),
  approval: fc.constant('always' as const),
});

/**
 * Arbitrary for prompts.
 */
export const promptArb = fc.string({ minLength: 1, maxLength: 200 });

/**
 * Arbitrary for cancellation timing scenarios.
 */
export const cancellationTimingArb = fc.record({
  cancelAfterMs: fc.integer({ min: 10, max: 300 }),
  completionDelayMs: fc.integer({ min: 50, max: 500 }),
});
```

### `fixtures/helpers.ts` (new file)

```typescript
import type { AgentEvent, AgentRunId } from '@core/domain/agents';
import type { AppError } from '@core/errors';
import type { Result } from 'neverthrow';
import type { StreamAgentFinalResult, StreamAgentItem } from '../../streamAgent';

/**
 * Collects all items from a streaming agent generator.
 */
export async function collectStreamItems(
  generator: AsyncGenerator<Result<AgentEvent, AppError> | StreamAgentItem, unknown>,
): Promise<{
  events: AgentEvent[];
  errors: AppError[];
  finalResult: StreamAgentFinalResult | undefined;
}> {
  const events: AgentEvent[] = [];
  const errors: AppError[] = [];
  let finalResult: StreamAgentFinalResult | undefined;

  for await (const item of generator) {
    if ('type' in item && item.type === 'final') {
      finalResult = item as StreamAgentFinalResult;
    } else if ('isOk' in item) {
      if (item.isOk()) {
        events.push(item.value);
      } else {
        errors.push(item.error);
      }
    }
  }

  return { events, errors, finalResult };
}

/**
 * Collects remaining items from a partially consumed generator.
 */
export async function collectRemainingItems(
  generator: AsyncGenerator<unknown, unknown>,
): Promise<{ events: AgentEvent[]; errors: AppError[]; finalResult: StreamAgentFinalResult | undefined }> {
  return collectStreamItems(generator as AsyncGenerator<Result<AgentEvent, AppError>, unknown>);
}

/**
 * Extracts stateId from an agent-started event.
 */
export function extractStateIdFromStartedEvent(
  eventResult: Result<AgentEvent, AppError>,
): AgentRunId {
  if (eventResult.isErr()) {
    throw new Error(`Expected ok result: ${eventResult.error.message}`);
  }
  const event = eventResult.value;
  if (event.type !== 'agent-started') {
    throw new Error(`Expected agent-started event, got: ${event.type}`);
  }
  return event.stateId;
}

/**
 * Delay utility.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Asserts final result exists and is ok.
 */
export function assertFinalResultOk(
  finalResult: StreamAgentFinalResult | undefined,
): AgentRunResult {
  if (!finalResult) throw new Error('Expected finalResult');
  if (finalResult.result.isErr()) {
    throw new Error(`Expected ok result: ${finalResult.result.error.message}`);
  }
  return finalResult.result.value;
}

/**
 * Extracts child state IDs from suspension stacks.
 */
export function extractChildStateIdsFromSuspensionStacks(state: AgentState): AgentRunId[] {
  const childIds: AgentRunId[] = [];
  for (const stack of state.suspensionStacks ?? []) {
    for (const entry of stack.agents) {
      if (entry.stateId) {
        childIds.push(entry.stateId);
      }
    }
  }
  return childIds;
}
```

---

## Execution Strategy

### Parallel Execution with Bun + fast-check

1. **File-level parallelism**: Bun runs test files in parallel workers
2. **Test-level parallelism**: Use `describe.concurrent` and `it.concurrent`
3. **Property test parallelism**: Split properties across concurrent test blocks

```typescript
// Example: Split property tests for parallel execution
describe.concurrent('Cancellation Timing Properties', () => {
  // These run in parallel
  it.concurrent('early cancellation (10-100ms)', async () => { ... });
  it.concurrent('mid cancellation (100-200ms)', async () => { ... });
  it.concurrent('late cancellation (200-300ms)', async () => { ... });
});
```

### Test Ordering

1. **cancellation.integration.test.ts** - Core tests (Groups 1-6)
2. **cancellationSubAgent.integration.test.ts** - Sub-agent tests (Group 7)

Both files run in parallel as separate Bun workers.

---

## Summary

| Group | Tests | Execution |
|-------|-------|-----------|
| 1. Cancel Suspended | 2 + 1 property | Sequential + Concurrent |
| 2. Cancel Running | 3 + 2 properties | Concurrent |
| 3. Idempotency/Errors | 3 | Sequential |
| 4. Concurrency/Lock | 2 | Sequential |
| 5. Crash Detection | 2 | Sequential |
| 6. Running State | 2 | Sequential |
| 7. Sub-Agent Recursive | 6 | All Concurrent |

**Total: ~21 tests + 3 property tests**
