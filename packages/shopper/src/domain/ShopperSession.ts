import { captureEventSchema } from '@capture/domain/events/CaptureEvent';
import zod from 'zod';
import { scenarioIdSchema } from './ScenarioId';
import { shopperSessionIdSchema } from './ShopperSessionId';
import { stepResultSchema } from './StepResult';

export const shopperSessionSchema = zod.object({
  schemaVersion: zod.literal(1).describe('the schema version'),
  id: shopperSessionIdSchema,
  scenarioId: scenarioIdSchema.describe('the scenario that was executed'),
  targetUrl: zod.string().url().describe('the URL that was visited'),
  startedAt: zod.coerce.date().describe('when the session started'),
  endedAt: zod.coerce.date().optional().describe('when the session ended'),
  stepResults: zod
    .array(stepResultSchema)
    .describe('results for each step executed'),
  capturedEvents: zod
    .array(captureEventSchema)
    .describe('events captured by the capture engine'),
});
export type ShopperSession = zod.infer<typeof shopperSessionSchema>;
