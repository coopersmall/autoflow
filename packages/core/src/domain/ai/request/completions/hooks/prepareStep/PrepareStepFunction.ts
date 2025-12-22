import zod from 'zod';
import { prepareStepOptionsSchema } from './PrepareStepOptions';
import { prepareStepResultSchema } from './PrepareStepResult';

export type PrepareStepFunction = zod.infer<typeof prepareStepFunctionSchema>;

/**
 * Function type for prepareStep callback.
 * Called before each step to allow modifying step parameters.
 */
export const prepareStepFunctionSchema = zod
  .function()
  .args(prepareStepOptionsSchema)
  .returns(
    zod.union([prepareStepResultSchema, zod.promise(prepareStepResultSchema)]),
  )
  .describe(
    'Optional function to modify settings for each step. Can change tool choice, active tools, system prompt, and messages.',
  );
