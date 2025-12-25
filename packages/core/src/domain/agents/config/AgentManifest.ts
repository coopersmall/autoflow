import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import { z as zod } from 'zod';
import type { AgentManifestConfig } from './AgentManifestConfig';
import { agentManifestConfigSchema } from './AgentManifestConfig';
import type { AgentManifestHooks } from './AgentManifestHooks';

// Combined type - config is validated, hooks are type-checked only
export interface AgentManifest {
  config: AgentManifestConfig;
  hooks: AgentManifestHooks;
}

// Schema for validating the outer manifest structure
// Hooks are runtime-only and type-checked by TypeScript, not validated by Zod.
// We use passthrough() to accept any object structure for hooks.
const agentManifestInputSchema = zod.strictObject({
  config: agentManifestConfigSchema,
  hooks: zod.object({}).passthrough().default({}),
});

// Validation function validates both config and hooks structure
export function validAgentManifest(
  input: unknown,
): Result<AgentManifest, AppError> {
  const result = validate(agentManifestInputSchema, input);
  if (result.isErr()) {
    return err(result.error);
  }

  // Result is now properly typed as AgentManifest
  return ok(result.value);
}
