import zod from 'zod';
import { messageSchema } from '../../messages';

export type ExecuteFunction = zod.infer<typeof executeFunctionSchema>;

const executeFunctionSchemaOptions = zod
  .strictObject({
    messages: zod
      .array(messageSchema)
      .describe('The messages in the conversation.'),
  })
  .describe('The options provided to the execute function.');

export const executeFunctionSchema = zod
  .function()
  .args(zod.unknown(), executeFunctionSchemaOptions)
  .returns(zod.promise(zod.any()))
  .describe('The function to execute the tool.');
