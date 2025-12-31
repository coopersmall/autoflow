import zod from 'zod';
import { onStepStartOptionsSchema } from './OnStepStartOptions';
import { onStepStartResultSchema } from './OnStepStartResult';

export type OnStepStartFunction = zod.infer<typeof onStepStartFunctionSchema>;

/**
 * Function type for onStepStart callback.
 * Called before each step to allow modifying step parameters.
 */
export const onStepStartFunctionSchema = zod
  .function()
  .args(onStepStartOptionsSchema)
  .returns(
    zod.union([onStepStartResultSchema, zod.promise(onStepStartResultSchema)]),
  )
  .describe(
    'Optional function to modify settings for each step. Can change tool choice, active tools, system prompt, and messages.',
  );
