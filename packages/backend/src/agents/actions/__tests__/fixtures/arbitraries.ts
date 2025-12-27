import type {
  AgentExecuteFunction,
  AgentManifest,
  StreamableEventType,
} from '@core/domain/agents';
import { AgentId } from '@core/domain/agents';
import type { StreamPart } from '@core/domain/ai';
import * as fc from 'fast-check';
import {
  createTestManifest,
  createTextCompletionParts,
  createToolCallCompletionParts,
} from './factories';

/**
 * Arbitrary for valid agent IDs (alphanumeric with hyphens, starting with letter).
 */
export const agentIdArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(s));

/**
 * Arbitrary for semantic versions.
 */
export const versionArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
  )
  .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

/**
 * Arbitrary for tool names.
 */
export const toolNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s));

/**
 * Arbitrary for simple text (non-empty, no control characters).
 */
export const simpleTextArb: fc.Arbitrary<string> = fc.string({
  minLength: 1,
  maxLength: 100,
});

/**
 * Arbitrary for streamable event types.
 * Note: Lifecycle events like agent-done, agent-error, agent-suspended,
 * sub-agent-start, sub-agent-end are always emitted and not configurable.
 */
export const streamableEventTypeArb: fc.Arbitrary<StreamableEventType> =
  fc.constantFrom(
    'text-delta' as const,
    'tool-call' as const,
    'tool-result' as const,
    'step-start' as const,
    'step-finish' as const,
  );

/**
 * Arbitrary for a subset of streamable event types.
 */
export const streamableEventTypesArb: fc.Arbitrary<StreamableEventType[]> = fc
  .subarray<StreamableEventType>(
    ['text-delta', 'tool-call', 'tool-result', 'step-start', 'step-finish'],
    { minLength: 1 },
  )
  .map((arr) => [...new Set(arr)]);

/**
 * Arbitrary for a simple agent manifest.
 */
export const simpleManifestArb: fc.Arbitrary<AgentManifest> = fc
  .tuple(agentIdArb, versionArb, fc.option(streamableEventTypesArb))
  .map(([id, version, events]) =>
    createTestManifest(id, {
      version,
      streamingEvents: events ?? undefined,
    }),
  );

/**
 * Arbitrary for text completion stream parts.
 */
export const textCompletionPartsArb: fc.Arbitrary<StreamPart[]> =
  simpleTextArb.map((text) => createTextCompletionParts(text));

/**
 * Arbitrary for tool call completion stream parts.
 */
export const toolCallCompletionPartsArb: fc.Arbitrary<StreamPart[]> = fc
  .tuple(toolNameArb, fc.uuid(), fc.jsonValue())
  .map(([toolName, toolCallId, input]) =>
    createToolCallCompletionParts(toolName, toolCallId, input),
  );

/**
 * Arbitrary for a tool definition with executor.
 */
export const toolWithExecutorArb: fc.Arbitrary<{
  name: string;
  definition: NonNullable<AgentManifest['config']['tools']>[number];
  executor: AgentExecuteFunction;
}> = toolNameArb.map((name) => ({
  name,
  definition: {
    type: 'function' as const,
    function: {
      name,
      description: `Test tool ${name}`,
      parameters: { type: 'object' as const, properties: {} },
    },
  },
  executor: async () => ({
    type: 'success' as const,
    output: { result: `${name}-result` },
  }),
}));

/**
 * Arbitrary for multiple tools.
 */
export const toolsArb: fc.Arbitrary<
  Array<{
    name: string;
    definition: NonNullable<AgentManifest['config']['tools']>[number];
    executor: AgentExecuteFunction;
  }>
> = fc
  .array(toolWithExecutorArb, { minLength: 1, maxLength: 3 })
  .map((tools) => {
    // Ensure unique tool names
    const seen = new Set<string>();
    return tools.filter((t) => {
      if (seen.has(t.name)) return false;
      seen.add(t.name);
      return true;
    });
  });

/**
 * Arbitrary for a parent-child manifest pair (for sub-agent testing).
 */
export const parentChildManifestArb: fc.Arbitrary<{
  parent: AgentManifest;
  child: AgentManifest;
}> = fc
  .tuple(agentIdArb, agentIdArb, versionArb)
  .filter(([parentId, childId]) => parentId !== childId)
  .map(([parentId, childId, version]) => {
    const child = createTestManifest(childId, {
      version,
      streamingEvents: ['text-delta'],
    });

    const parent = createTestManifest(parentId, {
      version,
      streamingEvents: ['text-delta', 'tool-call', 'tool-result'],
      subAgents: [
        {
          manifestId: AgentId(childId),
          manifestVersion: version,
          name: `invoke-${childId}`,
          description: `Invoke the ${childId} agent`,
        },
      ],
    });

    return { parent, child };
  });
