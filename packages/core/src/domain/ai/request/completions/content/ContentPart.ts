import zod from 'zod';
import { requestFilePartSchema } from './FilePart';
import { requestImagePartSchema } from './ImagePart';
import { requestReasoningPartSchema } from './ReasoningPart';
import { requestSourcePartSchema } from './SourcePart';
import { requestTextPartSchema } from './TextPart';
import { requestToolApprovalRequestPartSchema } from './ToolApprovalRequestPart';
import { requestToolApprovalResponsePartSchema } from './ToolApprovalResponsePart';
import { requestToolCallPartSchema } from './ToolCallPart';
import { requestToolErrorPartSchema } from './ToolPartError';
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

// Assistant messages can contain text, files, reasoning, tool calls, tool results, and tool approval requests
export const requestAssistantContentPartSchema = zod.discriminatedUnion(
  'type',
  [
    requestTextPartSchema,
    requestFilePartSchema,
    requestReasoningPartSchema,
    requestToolCallPartSchema,
    requestToolResultPartSchema,
    requestToolApprovalRequestPartSchema,
    requestToolErrorPartSchema,
    requestSourcePartSchema,
  ],
);

// Tool messages contain tool results and tool approval responses
export const requestToolContentPartSchema = zod.discriminatedUnion('type', [
  requestToolResultPartSchema,
  requestToolApprovalResponsePartSchema,
]);
