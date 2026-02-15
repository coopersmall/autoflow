import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import zod from 'zod';
import {
  AdversarialScenarioId,
  adversarialScenarioIdSchema,
} from './AdversarialScenarioId';

export const determinismScenarioSchema = zod.object({
  schemaVersion: zod.literal(1).describe('the schema version'),
  id: adversarialScenarioIdSchema,
  type: zod.literal('determinism').describe('scenario type discriminator'),
  name: zod.string().min(1).describe('human-readable name for the scenario'),
  targetUrl: zod.string().url().describe('the URL of the chat widget page'),
  prompt: zod.string().min(1).describe('the prompt to send N times'),
  repetitions: zod
    .number()
    .int()
    .min(2)
    .max(100)
    .describe('number of times to send the same prompt'),
  maxVarianceThreshold: zod
    .number()
    .min(0)
    .max(1)
    .default(0.2)
    .describe(
      'maximum acceptable variance ratio (0 = identical, 1 = completely different)',
    ),
});
export type DeterminismScenario = zod.infer<typeof determinismScenarioSchema>;

export const determinismTemplates = [
  {
    name: 'Greeting consistency',
    prompt: 'Hello, how are you today?',
    repetitions: 5,
  },
  {
    name: 'Product inquiry consistency',
    prompt: 'What is your return policy?',
    repetitions: 5,
  },
  {
    name: 'Pricing consistency',
    prompt: 'How much does the basic plan cost?',
    repetitions: 10,
  },
] as const;

export type DeterminismScenarioInput = Omit<
  zod.input<typeof determinismScenarioSchema>,
  'schemaVersion' | 'id' | 'type'
>;

export function createDeterminismScenario(
  input: DeterminismScenarioInput,
): Result<DeterminismScenario, AppError> {
  const raw = {
    schemaVersion: 1 as const,
    id: AdversarialScenarioId(),
    type: 'determinism' as const,
    ...input,
  };
  return validate(determinismScenarioSchema, raw);
}

export function createDeterminismScenarioFromTemplate(
  templateIndex: number,
  targetUrl: string,
  overrides?: Partial<
    Pick<DeterminismScenario, 'repetitions' | 'maxVarianceThreshold'>
  >,
): Result<DeterminismScenario, AppError> {
  const template = determinismTemplates[templateIndex];
  if (!template) {
    return validate(determinismScenarioSchema, {
      schemaVersion: 1,
      id: AdversarialScenarioId(),
      type: 'determinism',
      name: '',
      targetUrl,
      prompt: '',
      repetitions: 0,
    });
  }
  return createDeterminismScenario({
    name: template.name,
    targetUrl,
    prompt: template.prompt,
    repetitions: overrides?.repetitions ?? template.repetitions,
    ...(overrides?.maxVarianceThreshold !== undefined && {
      maxVarianceThreshold: overrides.maxVarianceThreshold,
    }),
  });
}
