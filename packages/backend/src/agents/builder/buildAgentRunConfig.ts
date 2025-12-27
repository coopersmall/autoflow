import type { AgentManifest, AgentRunConfig } from '@autoflow/core';
import type { AppError } from '@core/errors/AppError';
import { badRequest } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { validateReferences } from './validateReferences';

type ValidateAgentRunResponse = {
  rootManifest: AgentManifest;
};

export function validateAgentRunConfig(
  request: AgentRunConfig,
): Result<ValidateAgentRunResponse, AppError> {
  const { rootManifestId, manifests } = request;

  const rootManifest = manifests.find((m) => m.config.id === rootManifestId);
  if (!rootManifest) {
    return err(
      badRequest('Root manifest not found in provided manifests', {
        metadata: { rootManifestId },
      }),
    );
  }

  const validationResult = validateReferences(manifests);
  if (validationResult.isErr()) {
    return err(validationResult.error);
  }

  return ok({
    rootManifest,
  });
}
