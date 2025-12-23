import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import type { Tool, ToolSet } from 'ai';
import type { AnthropicBuiltinTools } from '../../../providers/anthropic/AnthropicBuiltinTools';
import type { CompletionsProvider } from '../../../providers/CompletionsProviders';
import type { GoogleBuiltinTools } from '../../../providers/google/GoogleBuiltinTools';
import type { OpenAIBuiltinTools } from '../../../providers/openai/OpenAIBuiltinTools';

/**
 * Provider builtin tools are passed directly to generateText/streamText.
 *
 * Note: We use Record<string, unknown> because the provider SDK tool factories
 * return tools with specific internal types that don't perfectly align with
 * the generic ToolSet type. The runtime structure is compatible with the AI SDK.
 */
export function convertBuiltinTools(
  provider: CompletionsProvider,
): ToolSet | undefined {
  if (provider.provider === 'openai' && provider.builtinTools) {
    return convertOpenAITools(provider.builtinTools);
  }
  if (provider.provider === 'anthropic' && provider.builtinTools) {
    return convertAnthropicTools(provider.builtinTools);
  }
  if (provider.provider === 'google' && provider.builtinTools) {
    return convertGoogleTools(provider.builtinTools);
  }
}

function convertOpenAITools(builtinTools: OpenAIBuiltinTools): ToolSet {
  const tools: ToolSet = {};

  if (builtinTools.webSearch) {
    const tool = openai.tools.webSearch(builtinTools.webSearch);
    tools.webSearch = convertTool(tool);
  }
  if (builtinTools.codeInterpreter) {
    const tool = openai.tools.codeInterpreter(builtinTools.codeInterpreter);
    tools.codeInterpreter = convertTool(tool);
  }

  if (builtinTools.fileSearch) {
    const tool = openai.tools.fileSearch(builtinTools.fileSearch);
    tools.fileSearch = convertTool(tool);
  }

  return tools;
}

function convertAnthropicTools(builtinTools: AnthropicBuiltinTools): ToolSet {
  const tools: ToolSet = {};

  if (builtinTools.bash) {
    const tool = anthropic.tools.bash_20250124(builtinTools.bash);
    tools.bash_20250124 = convertTool(tool);
  }

  if (builtinTools.memory) {
    const tool = anthropic.tools.memory_20250818(builtinTools.memory);
    tools.memory_20250818 = convertTool(tool);
  }

  if (builtinTools.textEditor) {
    const tool = anthropic.tools.textEditor_20241022({});
    tools.textEditor_20241022 = convertTool(tool);
  }

  if (builtinTools.computer) {
    const tool = anthropic.tools.computer_20250124(builtinTools.computer);
    tools.computer_20250124 = convertTool(tool);
  }

  if (builtinTools.webSearch) {
    const tool = anthropic.tools.webSearch_20250305(builtinTools.webSearch);
    tools.webSearch_20250305 = convertTool(tool);
  }

  if (builtinTools.webFetch) {
    const tool = anthropic.tools.webFetch_20250910(builtinTools.webFetch);
    tools.webFetch_20250910 = convertTool(tool);
  }

  if (builtinTools.codeExecution) {
    const tool = anthropic.tools.codeExecution_20250825(
      builtinTools.codeExecution,
    );
    tools.codeExecution_20250825 = convertTool(tool);
  }

  return tools;
}

function convertGoogleTools(builtinTools: GoogleBuiltinTools) {
  const tools: ToolSet = {};

  if (builtinTools.codeExecution) {
    const tool = google.tools.codeExecution(builtinTools.codeExecution);
    tools.codeExecution = convertTool(tool);
  }

  if (builtinTools.googleSearch) {
    const tool = google.tools.googleSearch(builtinTools.googleSearch);
    tools.googleSearch = convertTool(tool);
  }

  if (builtinTools.fileSearch) {
    const tool = google.tools.fileSearch(builtinTools.fileSearch);
    tools.fileSearch = convertTool(tool);
  }

  if (builtinTools.urlContext) {
    const tool = google.tools.urlContext(builtinTools.urlContext);
    tools.urlContext = convertTool(tool);
  }

  if (builtinTools.vertexRagStore) {
    const tool = google.tools.vertexRagStore(builtinTools.vertexRagStore);
    tools.vertexRagStore = convertTool(tool);
  }

  return tools;
}

type AnthropicBash = ReturnType<typeof anthropic.tools.bash_20250124>;
type AnthropicMemory = ReturnType<typeof anthropic.tools.memory_20250818>;
type AnthropicTextEditor = ReturnType<
  typeof anthropic.tools.textEditor_20241022
>;
type AnthropicComputer = ReturnType<typeof anthropic.tools.computer_20250124>;
type AnthropicWebSearch = ReturnType<typeof anthropic.tools.webSearch_20250305>;
type AnthropicWebFetch = ReturnType<typeof anthropic.tools.webFetch_20250910>;
type AnthropicCodeExecution = ReturnType<
  typeof anthropic.tools.codeExecution_20250825
>;

type GoogleCodeExecution = ReturnType<typeof google.tools.codeExecution>;
type GoogleSearch = ReturnType<typeof google.tools.googleSearch>;
type GoogleFileSearch = ReturnType<typeof google.tools.fileSearch>;
type GoogleURLContext = ReturnType<typeof google.tools.urlContext>;
type GoogleVertexRagStore = ReturnType<typeof google.tools.vertexRagStore>;

type OpenAIWebSearch = ReturnType<typeof openai.tools.webSearch>;
type OpenAICodeInterpreter = ReturnType<typeof openai.tools.codeInterpreter>;
type OpenAIFileSearch = ReturnType<typeof openai.tools.fileSearch>;

type BuiltinToolInstance =
  | AnthropicBash
  | AnthropicMemory
  | AnthropicTextEditor
  | AnthropicComputer
  | AnthropicWebSearch
  | AnthropicWebFetch
  | AnthropicCodeExecution
  | GoogleCodeExecution
  | GoogleSearch
  | GoogleFileSearch
  | GoogleURLContext
  | GoogleVertexRagStore
  | OpenAIWebSearch
  | OpenAICodeInterpreter
  | OpenAIFileSearch;

// biome-ignore lint: no-explicit-any
function convertTool(tool: BuiltinToolInstance): Tool<any, any> {
  // biome-ignore lint: no-explicit-any
  return tool as Tool<any, any>;
}
