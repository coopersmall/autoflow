import type {
  AgentExecuteFunction,
  AgentManifest,
  AgentRunResult,
  StreamableEventType,
} from "@core/domain/agents";
import { AgentId, AgentRunId } from "@core/domain/agents";
import type { StreamPart } from "@core/domain/ai";

/**
 * Creates a minimal agent manifest for testing.
 */
export function createTestManifest(
  id: string,
  options?: {
    version?: string;
    streamingEvents?: StreamableEventType[];
    tools?: AgentManifest["config"]["tools"];
    toolExecutors?: Map<string, AgentExecuteFunction>;
    subAgents?: AgentManifest["config"]["subAgents"];
    humanInTheLoop?: AgentManifest["config"]["humanInTheLoop"];
    mcpServers?: AgentManifest["config"]["mcpServers"];
  },
): AgentManifest {
  return {
    config: {
      id: AgentId(id),
      version: options?.version ?? "1.0.0",
      name: `Test Agent ${id}`,
      description: "Test agent for integration tests",
      provider: {
        provider: "anthropic",
        model: "claude-3-5-sonnet-20241022",
        settings: {},
      },
      instructions: "You are a test agent.",
      onTextOnly: "stop",
      streaming: options?.streamingEvents
        ? { events: options.streamingEvents }
        : undefined,
      tools: options?.tools,
      subAgents: options?.subAgents,
      humanInTheLoop: options?.humanInTheLoop,
      mcpServers: options?.mcpServers,
    },
    hooks: {
      toolExecutors: options?.toolExecutors,
    },
  };
}

/**
 * Creates a sequence of StreamParts that simulate a simple text completion.
 */
export function createTextCompletionParts(text: string): StreamPart[] {
  const now = new Date();
  return [
    { type: "start" },
    {
      type: "start-step",
      request: { body: undefined },
      warnings: [],
    },
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", text },
    { type: "text-end", id: "text-1" },
    {
      type: "finish-step",
      response: {
        id: "resp-1",
        timestamp: now,
        modelId: "claude-3-5-sonnet-20241022",
      },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      finishReason: "stop",
    },
    {
      type: "finish",
      finishReason: "stop",
      totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
  ];
}

/**
 * Creates a sequence of StreamParts that simulate a tool call completion.
 */
export function createToolCallCompletionParts(
  toolName: string,
  toolCallId: string,
  input: unknown,
): StreamPart[] {
  const now = new Date();
  return [
    { type: "start" },
    {
      type: "start-step",
      request: { body: undefined },
      warnings: [],
    },
    {
      type: "tool-call",
      toolCallId,
      toolName,
      input,
    },
    {
      type: "finish-step",
      response: {
        id: "resp-1",
        timestamp: now,
        modelId: "claude-3-5-sonnet-20241022",
      },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      finishReason: "tool-calls",
    },
    {
      type: "finish",
      finishReason: "tool-calls",
      totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
  ];
}

/**
 * Creates a sequence of StreamParts that simulate a tool approval request.
 */
export function createToolApprovalParts(
  approvalId: string,
  toolName: string,
  input: unknown,
): StreamPart[] {
  const now = new Date();
  return [
    { type: "start" },
    {
      type: "start-step",
      request: { body: undefined },
      warnings: [],
    },
    {
      type: "tool-approval-request",
      approvalId,
      toolCall: {
        toolCallId: "call-1",
        toolName,
        input,
      },
    },
    {
      type: "finish-step",
      response: {
        id: "resp-1",
        timestamp: now,
        modelId: "claude-3-5-sonnet-20241022",
      },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      finishReason: "tool-calls",
    },
    {
      type: "finish",
      finishReason: "tool-calls",
      totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
  ];
}

/**
 * Creates a complete agent run result.
 */
export function createCompleteResult(
  runId?: string,
): Extract<AgentRunResult, { status: "complete" }> {
  return {
    status: "complete",
    result: {
      manifestId: AgentId("test-agent"),
      status: "complete",
      text: "Task completed successfully",
      output: { success: true },
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
      steps: [],
      finishReason: "stop",
      totalUsage: {},
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

/**
 * Creates a tool definition (for use with humanInTheLoop config).
 * To require approval, add the tool name to manifest's humanInTheLoop.alwaysRequireApproval.
 */
export function createApprovalRequiredTool(
  name: string,
): NonNullable<AgentManifest["config"]["tools"]>[number] {
  return {
    type: "function",
    function: {
      name,
      description: `Tool ${name} that requires approval`,
      parameters: { type: "object", properties: {} },
    },
  };
}

/**
 * Creates a basic tool definition (no approval required).
 */
export function createToolDefinition(
  name: string,
): NonNullable<AgentManifest["config"]["tools"]>[number] {
  return {
    type: "function",
    function: {
      name,
      description: `Tool ${name}`,
      parameters: { type: "object", properties: {} },
    },
  };
}

/**
 * Creates parallel tool call completion parts (multiple tool calls in one response).
 */
export function createParallelToolCallParts(
  tools: Array<{ name: string; id: string; input: unknown }>,
): StreamPart[] {
  const now = new Date();
  const toolCalls: StreamPart[] = tools.map((t) => ({
    type: "tool-call" as const,
    toolCallId: t.id,
    toolName: t.name,
    input: t.input,
  }));

  return [
    { type: "start" },
    {
      type: "start-step",
      request: { body: undefined },
      warnings: [],
    },
    ...toolCalls,
    {
      type: "finish-step",
      response: {
        id: "resp-1",
        timestamp: now,
        modelId: "claude-3-5-sonnet-20241022",
      },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      finishReason: "tool-calls",
    },
    {
      type: "finish",
      finishReason: "tool-calls",
      totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    },
  ];
}
