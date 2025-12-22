import zod from 'zod';
import { onStepFinishResultSchema } from './OnStepFinishResult';

export type OnStepFinishFunction = zod.infer<typeof onStepFinishFunctionSchema>;

/**
 * Function type for onStepFinish callback.
 * Called after each step completes.
 */
export const onStepFinishFunctionSchema = zod
  .function()
  .args(onStepFinishResultSchema)
  .returns(zod.union([zod.void(), zod.promise(zod.void())]))
  .describe('Callback that is called when a step is finished.');
