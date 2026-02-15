import zod from 'zod';
import { captureSessionIdSchema } from './CaptureSessionId';
import { captureEventSchema } from './events/CaptureEvent';

export const captureSessionSchema = zod.object({
  schemaVersion: zod.literal(1).describe('the schema version'),
  id: captureSessionIdSchema,
  targetUrl: zod.string().url().describe('the URL of the captured page'),
  startedAt: zod.coerce.date().describe('when the capture session started'),
  endedAt: zod.coerce
    .date()
    .optional()
    .describe('when the capture session ended'),
  events: zod.array(captureEventSchema).describe('captured events'),
});
export type CaptureSession = zod.infer<typeof captureSessionSchema>;
