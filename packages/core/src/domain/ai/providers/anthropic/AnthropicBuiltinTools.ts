import zod from 'zod';

// Bash Tool
export type AnthropicBashToolOptions = zod.infer<
  typeof anthropicBashToolOptionsSchema
>;

export const anthropicBashToolOptionsSchema = zod
  .strictObject({})
  .describe(
    'Configuration options for the Anthropic bash tool. Note: The execute callback must be provided at runtime.',
  );

// Memory Tool
export type AnthropicMemoryToolOptions = zod.infer<
  typeof anthropicMemoryToolOptionsSchema
>;

export const anthropicMemoryToolOptionsSchema = zod
  .strictObject({})
  .describe(
    'Configuration options for the Anthropic memory tool. Note: The execute callback must be provided at runtime.',
  );

// Text Editor Tool
export type AnthropicTextEditorToolOptions = zod.infer<
  typeof anthropicTextEditorToolOptionsSchema
>;

export const anthropicTextEditorToolOptionsSchema = zod
  .strictObject({
    maxCharacters: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum number of characters to allow in the editor.'),
  })
  .describe(
    'Configuration options for the Anthropic text editor tool. Note: The execute callback must be provided at runtime.',
  );

// Computer Tool
export type AnthropicComputerToolOptions = zod.infer<
  typeof anthropicComputerToolOptionsSchema
>;

export const anthropicComputerToolOptionsSchema = zod
  .strictObject({
    displayWidthPx: zod
      .number()
      .int()
      .positive()
      .describe('Display width in pixels.'),
    displayHeightPx: zod
      .number()
      .int()
      .positive()
      .describe('Display height in pixels.'),
    displayNumber: zod
      .number()
      .int()
      .optional()
      .describe('Display number for X11 environments.'),
  })
  .describe(
    'Configuration options for the Anthropic computer tool. Note: The execute callback must be provided at runtime.',
  );

// Web Search Tool
export type AnthropicWebSearchToolOptions = zod.infer<
  typeof anthropicWebSearchToolOptionsSchema
>;

export const anthropicWebSearchToolOptionsSchema = zod
  .strictObject({
    maxUses: zod
      .number()
      .int()
      .positive()
      .describe(
        'Maximum number of web searches Claude can perform during the conversation.',
      ),
    allowedDomains: zod
      .array(zod.string())
      .optional()
      .describe(
        'Optional list of domains that Claude is allowed to search. If provided, searches will be restricted to these domains.',
      ),
    blockedDomains: zod
      .array(zod.string())
      .optional()
      .describe(
        'Optional list of domains that Claude should avoid when searching.',
      ),
    userLocation: zod
      .strictObject({
        type: zod.literal('approximate'),
        country: zod.string().optional().describe('Country code (e.g. US).'),
        region: zod.string().optional().describe('Region or state.'),
        city: zod.string().optional().describe('City name.'),
        timezone: zod
          .string()
          .optional()
          .describe('Timezone (e.g. America/Los_Angeles).'),
      })
      .optional()
      .describe(
        'Optional user location information to provide geographically relevant search results.',
      ),
  })
  .describe('Configuration options for the Anthropic web search tool.');

// Web Fetch Tool
export type AnthropicWebFetchToolOptions = zod.infer<
  typeof anthropicWebFetchToolOptionsSchema
>;

export const anthropicWebFetchToolOptionsSchema = zod
  .strictObject({
    maxUses: zod
      .number()
      .int()
      .positive()
      .describe('Maximum number of web fetches Claude can perform.'),
    allowedDomains: zod
      .array(zod.string())
      .optional()
      .describe('Only fetch from these domains.'),
    blockedDomains: zod
      .array(zod.string())
      .optional()
      .describe('Never fetch from these domains.'),
    citations: zod
      .strictObject({
        enabled: zod.boolean().describe('Whether to enable citations.'),
      })
      .optional()
      .describe(
        'Optional. Set "citations": {"enabled": true} to enable Claude to cite specific passages from fetched documents.',
      ),
    maxContentTokens: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Limits the amount of content that will be included in the context.',
      ),
  })
  .describe('Configuration options for the Anthropic web fetch tool.');

// Code Execution Tool
export type AnthropicCodeExecutionToolOptions = zod.infer<
  typeof anthropicCodeExecutionToolOptionsSchema
>;

export const anthropicCodeExecutionToolOptionsSchema = zod
  .strictObject({})
  .describe(
    'Configuration options for the Anthropic code execution tool. This tool gives Claude direct access to a real Python environment.',
  );

// Combined Builtin Tools Schema
export type AnthropicBuiltinTools = zod.infer<
  typeof anthropicBuiltinToolsSchema
>;

export const anthropicBuiltinToolsSchema = zod
  .strictObject({
    bash: anthropicBashToolOptionsSchema.optional(),
    memory: anthropicMemoryToolOptionsSchema.optional(),
    textEditor: anthropicTextEditorToolOptionsSchema.optional(),
    computer: anthropicComputerToolOptionsSchema.optional(),
    webSearch: anthropicWebSearchToolOptionsSchema.optional(),
    webFetch: anthropicWebFetchToolOptionsSchema.optional(),
    codeExecution: anthropicCodeExecutionToolOptionsSchema.optional(),
  })
  .describe('Anthropic built-in tools configuration.');
