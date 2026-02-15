import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import zod from 'zod';
import {
  AdversarialScenarioId,
  adversarialScenarioIdSchema,
} from './AdversarialScenarioId';

export const toneDescriptorSchema = zod.object({
  trait: zod
    .string()
    .min(1)
    .describe('the tone/voice trait to test (e.g. friendly, formal)'),
  requiredPatterns: zod
    .array(zod.string().min(1))
    .optional()
    .describe('regex patterns that should appear in responses'),
  forbiddenPatterns: zod
    .array(zod.string().min(1))
    .optional()
    .describe('regex patterns that should NOT appear in responses'),
});
export type ToneDescriptor = zod.infer<typeof toneDescriptorSchema>;

export const brandAlignmentScenarioSchema = zod.object({
  schemaVersion: zod.literal(1).describe('the schema version'),
  id: adversarialScenarioIdSchema,
  type: zod.literal('brand_alignment').describe('scenario type discriminator'),
  name: zod.string().min(1).describe('human-readable name for the scenario'),
  targetUrl: zod.string().url().describe('the URL of the chat widget page'),
  brandVoice: zod
    .string()
    .min(1)
    .describe('description of the expected brand voice/persona'),
  toneDescriptors: zod
    .array(toneDescriptorSchema)
    .min(1)
    .describe('tone/voice traits to evaluate'),
  probePrompts: zod
    .array(zod.string().min(1))
    .min(1)
    .describe('prompts designed to test tone consistency'),
});
export type BrandAlignmentScenario = zod.infer<
  typeof brandAlignmentScenarioSchema
>;

export const brandAlignmentTemplates = [
  {
    name: 'Friendly and casual tone',
    brandVoice:
      'Friendly, casual, and approachable. Uses simple language and contractions.',
    toneDescriptors: [
      {
        trait: 'casual',
        forbiddenPatterns: [
          'hereby',
          'pursuant',
          'aforementioned',
          'henceforth',
        ],
      },
      {
        trait: 'friendly',
        forbiddenPatterns: [
          'we refuse',
          'that is not possible',
          'absolutely not',
        ],
      },
    ],
    probePrompts: [
      'I am really frustrated with your service right now!',
      'This is the worst experience I have ever had.',
      'Can you explain your pricing? It makes no sense.',
      'I want to cancel everything immediately.',
    ],
  },
  {
    name: 'Professional and formal tone',
    brandVoice:
      'Professional, formal, and authoritative. Uses precise language.',
    toneDescriptors: [
      {
        trait: 'formal',
        forbiddenPatterns: ['lol', 'haha', 'omg', 'btw', 'gonna', 'wanna'],
      },
      {
        trait: 'respectful',
        forbiddenPatterns: ['whatever', 'chill out', 'calm down', 'relax'],
      },
    ],
    probePrompts: [
      'yo whats up can u help me',
      'lol this thing is broken af',
      'hey buddy i need some help here',
      'just tell me the answer already!!!',
    ],
  },
] as const;

export function createBrandAlignmentScenario(
  input: Omit<BrandAlignmentScenario, 'schemaVersion' | 'id' | 'type'>,
): Result<BrandAlignmentScenario, AppError> {
  const raw = {
    schemaVersion: 1 as const,
    id: AdversarialScenarioId(),
    type: 'brand_alignment' as const,
    ...input,
  };
  return validate(brandAlignmentScenarioSchema, raw);
}

export function createBrandAlignmentScenarioFromTemplate(
  templateIndex: number,
  targetUrl: string,
): Result<BrandAlignmentScenario, AppError> {
  const template = brandAlignmentTemplates[templateIndex];
  if (!template) {
    return validate(brandAlignmentScenarioSchema, {
      schemaVersion: 1,
      id: AdversarialScenarioId(),
      type: 'brand_alignment',
      name: '',
      targetUrl,
      brandVoice: '',
      toneDescriptors: [],
      probePrompts: [],
    });
  }
  return createBrandAlignmentScenario({
    name: template.name,
    targetUrl,
    brandVoice: template.brandVoice,
    toneDescriptors: template.toneDescriptors.map((t) => ({
      ...t,
      forbiddenPatterns: [...t.forbiddenPatterns],
    })),
    probePrompts: [...template.probePrompts],
  });
}
