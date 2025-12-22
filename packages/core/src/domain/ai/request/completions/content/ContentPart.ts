import zod from 'zod';
import { requestFilePartSchema } from './FilePart';
import { requestImagePartSchema } from './ImagePart';
import { requestReasoningPartSchema } from './ReasoningPart';
import { requestTextPartSchema } from './TextPart';
import { requestToolCallPartSchema } from './ToolCallPart';
import { requestToolResultPartSchema } from './ToolResultPart';

export type RequestUserContentPart = zod.infer<
  typeof requestUserContentPartSchema
>;
export type RequestAssistantContentPart = zod.infer<
  typeof requestAssistantContentPartSchema
>;
export type RequestToolContentPart = zod.infer<
  typeof requestToolContentPartSchema
>;

// User messages can contain text, images, and files
export const requestUserContentPartSchema = zod.discriminatedUnion('type', [
  requestTextPartSchema,
  requestImagePartSchema,
  requestFilePartSchema,
]);

// Assistant messages can contain text, files, reasoning, tool calls, and tool results
export const requestAssistantContentPartSchema = zod.discriminatedUnion(
  'type',
  [
    requestTextPartSchema,
    requestFilePartSchema,
    requestReasoningPartSchema,
    requestToolCallPartSchema,
    requestToolResultPartSchema,
  ],
);

// Tool messages contain tool results
export const requestToolContentPartSchema = requestToolResultPartSchema;
