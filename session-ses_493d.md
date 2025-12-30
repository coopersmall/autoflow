# Understanding agents framework in backend/src/agents

**Session ID:** ses_493d4c8f9ffe706aA4CZfytQxy
**Created:** 12/29/2025, 3:12:10 PM
**Updated:** 12/29/2025, 6:17:05 PM

---

## Assistant

```
Tool: edit
```

---

## Assistant

Now let me type-check to make sure nothing broke:

```
Tool: bash
```

---

## Assistant

Now let me update the todos and update the PLAN.md:

```
Tool: todowrite
```

---

## Assistant

```
Tool: edit
```

---

## User

---

## Assistant

# Session Summary: Agents Framework Production Readiness

## Project Context
We are preparing the agents framework in `/Users/coop/repos/autoflow/packages/backend/src/agents` for production. The framework handles AI agent execution with features like streaming, sub-agents, tool execution, suspension/resumption (HITL), and conversation tracking.

## What We Completed

### Phase 1: Code Quality Fixes ✅

**1.1 Object.freeze()** - Added to `createAgentsService` factory in `services/AgentsService.ts`

**1.2 Readonly modifiers** - Changed `AgentsServiceDeps` type to `AgentsServiceDependencies` interface with readonly modifiers in `services/AgentsService.ts`

**1.3 Fix TODO items in conversation hooks**:
- Added `providerConfig: AgentProviderConfig` to `AgentObserverContext` interface in `observers/AgentObserverContext.ts`
- Updated `observers/utils/applyObservers.ts` to pass `manifest.config.provider` as `providerConfig`
- Rewrote `observers/conversation/actions/buildConversationHooks.ts` to use actual provider/model from context instead of hardcoded values
- Updated test file `observers/conversation/__tests__/conversationObserver.integration.test.ts` with new `providerConfig` field

**1.4 Comment Cleanup**:
- Removed 3 "AI SDK" references in `actions/streaming/transformStreamPart.ts`
- Removed stale "Phase 5" comments from `hooks/AgentLifecycleHooks.ts` and `hooks/SubAgentLifecycleHooks.ts`
- Simplified verbose JSDoc in `actions/loop/handleOutputValidation.ts`
- Removed "Future:" commented-out code from:
  - `infrastructure/harness/buildToolExecutionHarness.ts`
  - `infrastructure/harness/buildStreamingToolExecutionHarness.ts`
  - `actions/validation/validateAgentConfig.ts`

### Phase 2: Complexity Reduction ✅

Refactored `actions/loop/unifiedAgentLoop.ts` from 659 lines to 419 lines (36% reduction):

- Created `actions/loop/streamCompletionStep.ts` (191 lines) containing:
  - `streamCompletionStep` async generator
  - `accumulateStreamPart` helper
  - Related interfaces

- Created `actions/loop/buildStepResult.ts` (52 lines) containing:
  - `buildStepResult` function
  - `BuildStepResultParams` interface

- Kept local helpers `buildMinimalTextResponse` and `buildFinalState` in `unifiedAgentLoop.ts`

### Phase 4: Documentation ✅

**4.1 JSDoc Review** - Verified key interfaces already have excellent documentation:
- `AgentRunConfig`, `AgentRunState`, `AgentManifestHooks`, `AgentObserver`

**4.2 Legacy Code Removal**:
- Deleted unused `actions/state/createAgentStateLegacy.ts`
- Removed its export from `actions/state/index.ts`

## Phase 3: Tests (Skipped for now)
The user chose to skip adding tests. The PLAN.md still contains detailed test specifications for:
- State management unit tests
- Validation unit tests (circular dependencies)
- Tool building unit tests
- Property tests for data transformations

## Key Files Modified
```
packages/backend/src/agents/
├── services/AgentsService.ts (Object.freeze, readonly deps)
├── observers/
│   ├── AgentObserverContext.ts (added providerConfig)
│   ├── utils/applyObservers.ts (pass providerConfig)
│   └── conversation/
│       ├── actions/buildConversationHooks.ts (use real provider/model)
│       └── __tests__/conversationObserver.integration.test.ts
├── actions/
│   ├── loop/
│   │   ├── unifiedAgentLoop.ts (refactored, uses new files)
│   │   ├── streamCompletionStep.ts (NEW)
│   │   ├── buildStepResult.ts (NEW)
│   │   └── handleOutputValidation.ts (simplified JSDoc)
│   ├── streaming/transformStreamPart.ts (removed AI SDK refs)
│   ├── validation/validateAgentConfig.ts (removed future comments)
│   └── state/
│       ├── index.ts (removed legacy export)
│       └── createAgentStateLegacy.ts (DELETED)
├── hooks/
│   ├── AgentLifecycleHooks.ts (removed Phase 5 comment)
│   └── SubAgentLifecycleHooks.ts (removed Phase 5 comment)
└── infrastructure/harness/
    ├── buildToolExecutionHarness.ts (removed future comments)
    └── buildStreamingToolExecutionHarness.ts (removed future comments)
```

## Plan Document
The full plan is in `/Users/coop/repos/autoflow/PLAN.md` with checkboxes showing completed items.

## What's Next
All planned phases except Phase 3 (tests) are complete. Potential next steps:
1. Run full test suite to verify all changes: `cd packages/backend && bun test`
2. Run linting: `make lint && make format`
3. Implement Phase 3 tests if desired
4. Review any other areas of the codebase for similar cleanup

## Commands to Verify
```bash
cd /Users/coop/repos/autoflow
make lint          # Check code style
make format        # Fix formatting
make tsc           # Type check
cd packages/backend && bun test  # Run tests
```

---

## User

---

## Assistant

Let me check the current state of the PLAN.md and see what's left to do.

```
Tool: read
```

---

## Assistant

The plan shows:
- **Phase 1 (Code Quality)**: ✅ Complete
- **Phase 2 (Complexity Reduction)**: ✅ Complete  
- **Phase 3 (Tests)**: ⏸️ Skipped (all items unchecked)
- **Phase 4 (Documentation)**: ✅ Complete

The plan says to run verification commands at the end. Let me run those now to make sure everything is working properly:

```
Tool: bash
```

```
Tool: bash
```

---

## Assistant

Type checking passed, but there are some formatting issues. Let me fix those:

```
Tool: bash
```

---

## Assistant

Formatting fixed 11 files. There's one lint error about an unused variable in a test file. Let me fix that:

```
Tool: read
```

---

## Assistant

The variable is set but never read. It seems like it was intended for an assertion that was removed. Let me prefix it with underscore to indicate it's intentionally unused:

```
Tool: edit
```

---

## Assistant

```
Tool: bash
```

---

## Assistant

Now let me run lint again to verify everything is clean:

```
Tool: bash
```

---

## Assistant

There's a pre-existing lint error in `streamExecuteToolCalls.ts` - a generator function that doesn't yield. Let me check if this is in our scope or pre-existing:

```
Tool: read
```

---

## Assistant

This is a pre-existing issue, not something we introduced. The generator doesn't yield but just returns. The lint rule wants generators to yield. The simplest fix is to make it a regular async function that returns the same type as the generator's return value:

```
Tool: read
```

---

## Assistant

Let me see how `createUnknownToolGenerator` is used:

```
Tool: grep
```

---

## Assistant

```
Tool: read
```

---

## Assistant

I see - it's used to create a "dummy generator" for unknown tools. The generator interface is required by the GeneratorState type, but it never yields. The cleanest fix is to make it actually yield nothing before returning, which satisfies the lint rule while keeping the same behavior:

```
Tool: edit
```

---

## Assistant

```
Tool: bash
```

---

## Assistant

The biome-ignore comment needs to be on the function declaration line itself, not inside the body. Let me fix this properly:

```
Tool: edit
```

---

## Assistant

```
Tool: bash
```

---

## Assistant

```
Tool: bash
```

---

## Assistant

Lint passes. Now let's run the type check and tests:

```
Tool: bash
```

```
Tool: bash
```

---

## Assistant

Almost all tests pass, but there's 1 failure. Let me see which test failed:

```
Tool: bash
```

---

## Assistant

There are 2 failing tests - both appear to be pre-existing issues unrelated to our changes:

1. **`should return already-running for concurrent approval attempts`** - A concurrency test in cancellation tests (likely a flaky test)
2. **`should produce valid JSON that can be parsed for complete results`** - A property test failure with `-0` vs `0` comparison (JavaScript's negative zero edge case)

Let me verify these are pre-existing by checking if the test files were modified by us:

```
Tool: bash
```

---

## Assistant

```
Tool: bash
```

---

## Assistant

Let me see what changes were made to the failing test:

```
Tool: bash
```

---

## Assistant

These tests are all new tests from a recent commit, not pre-existing. Let me look at the property test that's failing:

```
Tool: read
```

---

## Assistant

The failing test is a property test that compares `-0` vs `0`. In JavaScript, `-0 === 0` is `true`, but `toEqual` uses a stricter comparison that differentiates them. This is a known edge case with `JSON.stringify` which converts `-0` to `0`.

The issue is that `fc.jsonValue()` can generate `-0`, but `JSON.stringify` converts it to `0`. The test then fails because the original value was `-0` but after JSON round-trip it becomes `0`.

This is a pre-existing test bug (not related to our changes). The fix is to account for the JSON serialization behavior. Let me fix this:

```
Tool: edit
```

---

## Assistant

Now let me run the tests again to verify the fix:

```
Tool: bash
```

---

## Assistant

Now let me run the full test suite to see if the other failure is a flaky test:

```
Tool: bash
```

---

## Assistant

There's still 1 failure. Let me check which one:

```
Tool: bash
```

---

## Assistant

Let me look at this test:

```
Tool: read
```

---

## Assistant

This looks like a concurrency test that may be flaky. Let me run it in isolation a few times to see:

```
Tool: bash
```

---

## Assistant

```
Tool: bash
```

---

## Assistant

Let me look at what the result actually is:

```
Tool: read
```

---

## Assistant

The test is getting an error result. Let me add debug output to understand what's happening:

```
Tool: read
```

---

## Assistant

This is a pre-existing integration test that's failing - not related to our changes. The test expects that when one agent run is in progress, a concurrent run with the same stateId should return "already-running". But the test is getting an error result instead.

This looks like a real bug or test issue that exists in the codebase. Since it's not related to our changes (we didn't touch cancellation or locking logic), let me check if this test was already failing before our changes:

```
Tool: bash
```

---

## Assistant

The test was already failing before our changes. Let me restore our changes:

```
Tool: bash
```

---

## Assistant

The failing test is a pre-existing issue in the codebase, not caused by our changes. 

## Summary

All our verification steps are complete:

| Check | Result |
|-------|--------|
| `make tsc` (TypeScript) | ✅ Pass |
| `make lint` | ✅ Pass (after fixing pre-existing issues) |
| `make format` | ✅ Applied |
| Tests | ✅ 552/553 pass (1 pre-existing failure unrelated to our changes) |

### Additional Fixes Made During Verification

1. **Fixed unused variable lint error** in `cancellationSubAgent.integration.test.ts` - prefixed with underscore
2. **Fixed generator lint error** in `streamExecuteToolCalls.ts` - added biome-ignore comment for intentional no-yield generator
3. **Fixed property test failure** in `convertResultToToolPart.test.ts` - JSON round-trip for `-0` edge case

### Pre-existing Issue (Not Our Change)

The test `should return already-running for concurrent approval attempts` was already failing before our changes. This is a concurrency test in the cancellation suite that appears to have a race condition or bug unrelated to our production readiness work.

---

**All planned phases are complete!** The agents framework is now more production-ready with:
- Immutable service factory
- Readonly dependencies  
- Provider/model info passed through observer context
- Cleaned up comments and removed stale references
- Reduced complexity in `unifiedAgentLoop.ts` (659 → 419 lines)
- Removed legacy unused code

---

## User

ca you help me fix the tests

---

## Assistant

I'll help you fix the failing test. Let me investigate the issue more deeply.

```
Tool: bash
```

---

## Assistant

Let me add some debugging to understand what result is actually being returned:

```
Tool: read
```

---

## Assistant

```
Tool: edit
```

---

## Assistant

```
Tool: bash
```

---

## Assistant

```
Tool: bash
```

---

## Assistant

Now I can see the issue. The error is:
> `Cannot continue agent with status: running. Expected status: suspended.`

This means the second approval attempt (`gen3`) is getting past the lock and finding the state is "running" instead of "suspended". The lock check might not be working properly, or there's a race condition.

Let me look at how the lock is acquired and checked:

```
Tool: grep
```

---

## Assistant

```
Tool: read
```

---

## Assistant

I see. The lock is acquired at the beginning. Let me check the lock implementation:

```
Tool: grep
```

---

## Assistant

```
Tool: grep
```

---

## Assistant

```
Tool: glob
```

---

## Assistant

```
Tool: read
```

---

## Assistant

Now let me look at the mock used in the test:

```
Tool: read
```

---

## Assistant

Now let me look at the test setup to understand how the lock is configured:

```
Tool: read
```

---

## Assistant

Let me look at the full test to understand the flow:

```
Tool: read
```

---

## Assistant

Now I understand the test better. The issue is:

1. `gen1` completes and agent is suspended (lock released)
2. `gen2` starts an approval, acquires the lock, and starts the slow completion
3. `gen3` tries another approval concurrently

The problem is `gen3` is getting past the lock somehow and then failing when it tries to load state that is now "running" (because `gen2` updated it).

Let me look at `orchestrateAgentRun` to understand the flow:

```
Tool: grep
```

---

## Assistant

```
Tool: read
```

---

## Assistant

The problem is clear now. `prepareRunState` is called before the lock is acquired (lock is acquired inside `executeAgent`). If `prepareRunState` validates state before the lock, but the state has already been updated to "running" by another process, then it will fail with "Cannot continue agent with status: running".

Let me look at `prepareRunState`:

```
Tool: glob
```

---

## Assistant

```
Tool: read
```

---

## Assistant

```
Tool: read
```

---

## Assistant

Now I see the issue! In `prepareFromApproval`, line 40-46 calls `loadAndValidateState` with expected status `'suspended'`, but if another process has already acquired the lock and updated the state to `'running'`, this validation will fail.

The problem is the lock is acquired in `executeAgent` (line 97 of `executeAgent.ts`), but the state validation happens in `prepareRunState` before the lock is acquired. This is a race condition.

The fix should be: If the state is "running" when we try to continue, we should return `already-running` instead of an error. Let me look at `loadAndValidateState`:

```
Tool: read
```

---

## Assistant

```
Tool: read
```

---

## Assistant

Now I understand the full picture. The issue is:

1. When `gen3` calls `prepareFromApproval`, it expects state to be `'suspended'`
2. But `gen2` has already acquired the lock and updated state to `'running'`
3. So `validateAgentState` fails with "Cannot continue agent with status: running"

The fix needs to happen in the prepare functions. When we detect the state is `'running'` instead of `'suspended'`, we should return a result that tells `orchestrateAgentRun` to return `already-running`.

Let me look at the `PrepareResult` type to see the options:

```
Tool: grep
```

---

## Assistant

```
Tool: grep
```

---

## Assistant

```
Tool: grep
```

---

## Assistant

```
Tool: read
```

---

## Assistant

There's currently no `already-running` variant in `PrepareResult`. I have a few options:

1. **Add an `already-running` variant to `PrepareResult`** - cleanest but requires changes in multiple places
2. **Check lock first in `prepareFromApproval`** - but we don't have access to the lock in prepare functions
3. **Return a special error that `orchestrateAgentRun` can interpret as `already-running`**

Looking at the design, the cleanest approach is to add an `already-running` variant to `PrepareResult`. Let me implement this:

```
Tool: todowrite
```

---

## Assistant

```
Tool: edit
```

---

## Assistant

```
Tool: todowrite
```

---

## Assistant

Now I need to update the prepare functions. The key insight is that `loadAndValidateState` currently returns an error when the status doesn't match. Instead, we need to handle the case where status is `running` separately.

Let me create a new helper or modify the approach:

```
Tool: read
```

---

## Assistant

I need to modify the approach. Instead of using `loadAndValidateState` (which validates status), I'll:
1. Load state first with `getAgentState`
2. Check if it's "running" and return `already-running`
3. Then validate the rest

```
Tool: edit
```

---

## Assistant

```
Tool: todowrite
```

---

## Assistant

Now let me update `prepareFromReply`:

```
Tool: read
```

---

## Assistant

```
Tool: edit
```

---

## Assistant

```
Tool: todowrite
```

---

## Assistant

```
Tool: read
```

---

## Assistant

```
Tool: edit
```

---

## Assistant

```
Tool: todowrite
```

---

## Assistant

Now let's update `orchestrateAgentRun` to handle the `already-running` result:

```
Tool: read
```

---

## Assistant

I need to add a handler for the `already-running` case:

```
Tool: edit
```

---

## Assistant

The TypeScript narrowing isn't complete. I need to make the type narrowing explicit. Let me check the current state after the edit:

```
Tool: read
```

---

## Assistant

The issue is that after the guard clauses, TypeScript should narrow the type to `start | continue`. But I see TypeScript is still seeing other types in the union. This is because the `delegate` case returns with `yield*` but doesn't have a proper return type check.

Let me check the full narrowing context:

```
Tool: read
```

---

## Assistant

The issue is that TypeScript doesn't recognize that after the `if` blocks with returns/yields, the type should be narrowed. The problem is that `yield*` in the delegate block doesn't directly return, so TypeScript control flow analysis might be confused.

Looking at this more, the issue is that TypeScript sees `prepareValue` type, and after checking `type !== 'delegate'`, `type !== 'suspended'`, and `type !== 'already-running'`, the type should be `start | continue`. But `delegate` uses `yield*` which complicates control flow.

Let me try adding explicit type assertions or restructuring with explicit early returns. The simplest fix is to check specifically for the types we need:

```
Tool: edit
```

---

## Assistant

```
Tool: bash
```

---

## Assistant

Let me fix the error creation:

```
Tool: edit
```

---

## Assistant

I need to import `unreachable`:

```
Tool: read
```

---

## Assistant

```
Tool: edit
```

---

## Assistant

```
Tool: bash
```

---

## Assistant

TypeScript passes. Now let me run the formatter and then the tests:

```
Tool: bash
```

---

## Assistant

```
Tool: todowrite
```

---

## Assistant

```
Tool: read
```

---

## Assistant

```
Tool: edit
```

---

## Assistant

```
Tool: bash
```

---

## Assistant

```
Tool: todowrite
```

---

## Assistant

Now let me run the tests:

```
Tool: bash
```

---

## Assistant

All 21 cancellation tests pass now. Let me run the full test suite:

```
Tool: bash
```

---

## Assistant

All 553 tests pass. Let me run the linting and type check to make sure everything is clean:

```
Tool: bash
```

---

## Assistant

```
Tool: todowrite
```

---

## Assistant

All tests pass. Here's a summary of the fix:

## Summary: Fixed Concurrent Approval Race Condition

### Problem
When two concurrent approval attempts were made on the same suspended agent:
1. First approval (`gen2`) acquired the lock and updated state to `'running'`
2. Second approval (`gen3`) was failing with error "Cannot continue agent with status: running. Expected status: suspended."

The issue was that `prepareFromApproval` (and other prepare functions) validated the state status **before** the lock was acquired, but another process could update the state to `'running'` in the meantime.

### Solution
Added an `already-running` variant to handle this race condition gracefully:

1. **Added `already-running` to `PrepareResult` type** (`domain/execution/PrepareResult.ts`)
   - New variant: `{ type: 'already-running'; runId: AgentRunId }`

2. **Updated prepare functions to detect running state**:
   - `prepareFromApproval.ts` - Check if state is `'running'` before validation and return `already-running`
   - `prepareFromReply.ts` - Same check
   - `prepareFromContinue.ts` - Same check

3. **Updated `orchestrateAgentRun` to handle `already-running`**:
   - Returns `ok({ status: 'already-running', runId })` instead of an error

### Files Changed
- `packages/backend/src/agents/domain/execution/PrepareResult.ts`
- `packages/backend/src/agents/actions/prepare/prepareFromApproval.ts`
- `packages/backend/src/agents/actions/prepare/prepareFromReply.ts`
- `packages/backend/src/agents/actions/prepare/prepareFromContinue.ts`
- `packages/backend/src/agents/actions/orchestrateAgentRun.ts`
- `packages/backend/src/agents/actions/__tests__/cancellation.integration.test.ts` (removed debug logging)

### Result
- All 553 tests pass
- Lint passes
- TypeScript type check passes

---

