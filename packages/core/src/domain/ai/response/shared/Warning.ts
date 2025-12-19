import zod from 'zod';

export type Warning = zod.infer<typeof warningSchema>;

export const warningSchema = zod
  .strictObject({
    type: zod.string().describe('The type of warning.'),
    message: zod.string().describe('The warning message.'),
  })
  .describe('A warning from the model provider.');
