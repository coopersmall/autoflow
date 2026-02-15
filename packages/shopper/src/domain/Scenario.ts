import zod from 'zod';
import { scenarioIdSchema } from './ScenarioId';

export const scenarioStepSchema = zod.object({
  message: zod.string().min(1).describe('the user message to send'),
  expectedBehaviors: zod
    .array(zod.string().min(1))
    .optional()
    .describe('expected response patterns or behaviors'),
});
export type ScenarioStep = zod.infer<typeof scenarioStepSchema>;

export const scenarioSchema = zod.object({
  schemaVersion: zod.literal(1).describe('the schema version'),
  id: scenarioIdSchema,
  name: zod.string().min(1).describe('human-readable name for the scenario'),
  targetUrl: zod.string().url().describe('the URL of the chat widget page'),
  steps: zod
    .array(scenarioStepSchema)
    .min(1)
    .describe('ordered list of user messages to send'),
});
export type Scenario = zod.infer<typeof scenarioSchema>;
