import { type AnthropicProvider, anthropic } from '@ai-sdk/anthropic';
import { type GoogleGenerativeAIProvider, google } from '@ai-sdk/google';
import { type OpenAIProvider, openai } from '@ai-sdk/openai';
import type { Tool as AITool, ToolSet } from 'ai';
import type { AnthropicBuiltinTools } from '../../../providers/anthropic/AnthropicBuiltinTools';
import type { CompletionsProvider } from '../../../providers/CompletionsProviders';
import type { GoogleBuiltinTools } from '../../../providers/google/GoogleBuiltinTools';
import type { OpenAIBuiltinTools } from '../../../providers/openai/OpenAIBuiltinTools';

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

type OpenAIToolSet = Partial<Record<keyof OpenAIProvider['tools'], AITool>>;

function convertOpenAITools(builtinTools: OpenAIBuiltinTools): OpenAIToolSet {
  const toolSet: OpenAIToolSet = {};
  if (builtinTools.webSearch) {
    const tool = openai.tools.webSearch(builtinTools.webSearch);
    toolSet.webSearch = tool;
  }
  if (builtinTools.codeInterpreter) {
    const tool = openai.tools.codeInterpreter(builtinTools.codeInterpreter);
    toolSet.codeInterpreter = tool;
  }
  if (builtinTools.fileSearch) {
    const tool = openai.tools.fileSearch(builtinTools.fileSearch);
    toolSet.fileSearch = tool;
  }
  return toolSet;
}

type AnthropicToolSet = Partial<
  Record<keyof AnthropicProvider['tools'], AITool>
>;

function convertAnthropicTools(
  builtinTools: AnthropicBuiltinTools,
): AnthropicToolSet {
  const toolSet: AnthropicToolSet = {};
  if (builtinTools.bash) {
    const tool = anthropic.tools.bash_20250124(builtinTools.bash);
    toolSet.bash_20250124 = tool;
  }
  if (builtinTools.memory) {
    const tool = anthropic.tools.memory_20250818(builtinTools.memory);
    toolSet.memory_20250818 = tool;
  }
  if (builtinTools.textEditor) {
    const tool = anthropic.tools.textEditor_20241022({});
    toolSet.textEditor_20241022 = tool;
  }
  if (builtinTools.computer) {
    const tool = anthropic.tools.computer_20250124(builtinTools.computer);
    toolSet.computer_20250124 = tool;
  }
  if (builtinTools.webSearch) {
    const tool = anthropic.tools.webSearch_20250305(builtinTools.webSearch);
    toolSet.webSearch_20250305 = tool;
  }
  if (builtinTools.webFetch) {
    const tool = anthropic.tools.webFetch_20250910(builtinTools.webFetch);
    toolSet.webFetch_20250910 = tool;
  }
  if (builtinTools.codeExecution) {
    const tool = anthropic.tools.codeExecution_20250825(
      builtinTools.codeExecution,
    );
    toolSet.codeExecution_20250825 = tool;
  }
  return toolSet;
}

type GoogleToolSet = Partial<
  Record<keyof GoogleGenerativeAIProvider['tools'], AITool>
>;

function convertGoogleTools(builtinTools: GoogleBuiltinTools): GoogleToolSet {
  const toolSet: GoogleToolSet = {};
  if (builtinTools.codeExecution) {
    const tool = google.tools.codeExecution(builtinTools.codeExecution);
    toolSet.codeExecution = tool;
  }
  if (builtinTools.googleSearch) {
    const tool = google.tools.googleSearch(builtinTools.googleSearch);
    toolSet.googleSearch = tool;
  }
  if (builtinTools.fileSearch) {
    const tool = google.tools.fileSearch(builtinTools.fileSearch);
    toolSet.fileSearch = tool;
  }
  if (builtinTools.urlContext) {
    const tool = google.tools.urlContext(builtinTools.urlContext);
    toolSet.urlContext = tool;
  }
  if (builtinTools.vertexRagStore) {
    const tool = google.tools.vertexRagStore(builtinTools.vertexRagStore);
    toolSet.vertexRagStore = tool;
  }
  return toolSet;
}
