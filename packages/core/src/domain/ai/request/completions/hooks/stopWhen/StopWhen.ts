import zod from 'zod';

export type StopWhen = zod.infer<typeof stopWhenSchema>;

export const stopWhenToolUseSchema = zod
  .strictObject({
    type: zod.literal('toolUse'),
    name: zod
      .string()
      .describe('The name of the tool that was used to stop generation.'),
  })
  .describe(
    'Indicates that the model should stop generation when a tool is used.',
  );

export const stopWhenStepCountSchema = zod
  .strictObject({
    type: zod.literal('stepCount'),
    stepCount: zod
      .number()
      .describe('The number of steps after which to stop generation.'),
  })
  .describe(
    'Indicates that the model should stop generation after a number of steps.',
  );

export const stopWhenSchema = zod.discriminatedUnion('type', [
  stopWhenToolUseSchema,
  stopWhenStepCountSchema,
]);
