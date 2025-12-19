import zod from 'zod';
import { messageSchema } from '../messages/Message';
import {
  maxOutputTokensSchema,
  seedSchema,
  stopSequencesSchema,
} from '../shared/GenerationLimits';
import {
  frequencyPenaltySchema,
  presencePenaltySchema,
  topKSchema,
  topPSchema,
} from '../shared/SamplingParameters';
import { temperatureSchema } from '../shared/Temperature';

export type BaseCompletionsRequest = zod.infer<
  typeof baseCompletionsRequestSchema
>;

export const baseCompletionsRequestSchema = zod.strictObject({
  // Messages
  messages: zod.array(messageSchema).describe('The conversation messages.'),

  // Sampling parameters
  temperature: temperatureSchema,
  topP: topPSchema,
  topK: topKSchema,
  presencePenalty: presencePenaltySchema,
  frequencyPenalty: frequencyPenaltySchema,

  // Generation limits
  maxOutputTokens: maxOutputTokensSchema,
  stopSequences: stopSequencesSchema,
  seed: seedSchema,
});
