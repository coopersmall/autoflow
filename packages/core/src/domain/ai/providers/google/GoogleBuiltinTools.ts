import zod from 'zod';

// Code Execution Tool
export type GoogleCodeExecutionToolOptions = zod.infer<
  typeof googleCodeExecutionToolOptionsSchema
>;

export const googleCodeExecutionToolOptionsSchema = zod
  .strictObject({})
  .describe(
    'Configuration options for the Google code execution tool. With Code Execution, certain models can generate and execute Python code to perform calculations, solve problems, or provide more accurate information.',
  );

// Google Search Tool
export type GoogleSearchToolOptions = zod.infer<
  typeof googleSearchToolOptionsSchema
>;

export const googleSearchToolOptionsSchema = zod
  .strictObject({})
  .describe(
    'Configuration options for the Google search tool. With search grounding, the model has access to the latest information using Google search.',
  );

// File Search Tool
export type GoogleFileSearchToolOptions = zod.infer<
  typeof googleFileSearchToolOptionsSchema
>;

export const googleFileSearchToolOptionsSchema = zod
  .strictObject({
    fileSearchStoreNames: zod
      .array(zod.string())
      .describe(
        'Array of File Search store names. Format: projects/my-project/locations/us/fileSearchStores/my-store',
      ),
    metadataFilter: zod
      .string()
      .optional()
      .describe(
        'Optional metadata filter for file search (e.g. author = "Robert Graves").',
      ),
    topK: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe('Number of top results to return.'),
  })
  .describe(
    'Configuration options for the Google file search tool. The File Search tool lets Gemini retrieve context from your own documents. Only Gemini 2.5 models support this feature.',
  );

// URL Context Tool
export type GoogleUrlContextToolOptions = zod.infer<
  typeof googleUrlContextToolOptionsSchema
>;

export const googleUrlContextToolOptionsSchema = zod
  .strictObject({})
  .describe(
    'Configuration options for the Google URL context tool. The URL context tool allows you to provide specific URLs that you want the model to analyze directly. You can add up to 20 URLs per request. Only supported for Gemini 2.0 Flash models and above.',
  );

// Google Maps Tool
export type GoogleMapsToolOptions = zod.infer<
  typeof googleMapsToolOptionsSchema
>;

export const googleMapsToolOptionsSchema = zod
  .strictObject({})
  .describe(
    'Configuration options for the Google Maps grounding tool. With Google Maps grounding, the model has access to Google Maps data for location-aware responses. This enables providing local data and geospatial context, such as finding nearby restaurants. Supported on Gemini 2.0 and newer models.',
  );

// Vertex RAG Store Tool
export type GoogleVertexRagStoreToolOptions = zod.infer<
  typeof googleVertexRagStoreToolOptionsSchema
>;

export const googleVertexRagStoreToolOptionsSchema = zod
  .strictObject({
    ragCorpus: zod
      .string()
      .describe(
        'The RagCorpus resource name. Format: projects/{project}/locations/{location}/ragCorpora/{rag_corpus}',
      ),
    topK: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'The number of top contexts to retrieve from your RAG corpus. Defaults to the corpus configuration if not specified.',
      ),
  })
  .describe(
    'Configuration options for the Vertex RAG Store tool. With RAG Engine Grounding, the model has access to your custom knowledge base using the Vertex RAG Engine. Only supported with Vertex Gemini models using @ai-sdk/google-vertex provider.',
  );

// Combined Builtin Tools Schema
export type GoogleBuiltinTools = zod.infer<typeof googleBuiltinToolsSchema>;

export const googleBuiltinToolsSchema = zod
  .strictObject({
    codeExecution: googleCodeExecutionToolOptionsSchema.optional(),
    googleSearch: googleSearchToolOptionsSchema.optional(),
    fileSearch: googleFileSearchToolOptionsSchema.optional(),
    urlContext: googleUrlContextToolOptionsSchema.optional(),
    googleMaps: googleMapsToolOptionsSchema.optional(),
    vertexRagStore: googleVertexRagStoreToolOptionsSchema.optional(),
  })
  .describe('Google Generative AI built-in tools configuration.');
