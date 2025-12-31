import { describe, expect, it } from 'bun:test';
import { AgentId, ManifestKey } from '@autoflow/core';
import type { AgentManifest } from '@backend/agents/domain';
import { lookupManifest } from '../lookupManifest';
import { createAgentManifest, createSuspensionStackEntry } from './fixtures';

describe('lookupManifest', () => {
  it('should return manifest when found', () => {
    const entry = createSuspensionStackEntry({
      manifestId: AgentId('test-agent'),
      manifestVersion: '1.0.0',
    });

    const manifest = createAgentManifest('test-agent', '1.0.0');
    const manifestMap = new Map<ManifestKey, AgentManifest>([
      [ManifestKey(manifest.config), manifest],
    ]);

    const result = lookupManifest(entry, manifestMap);

    expect(result).toBe(manifest);
  });

  it('should return undefined when manifest not found', () => {
    const entry = createSuspensionStackEntry({
      manifestId: AgentId('test-agent'),
      manifestVersion: '1.0.0',
    });

    const manifestMap = new Map<ManifestKey, AgentManifest>();

    const result = lookupManifest(entry, manifestMap);

    expect(result).toBeUndefined();
  });

  it('should use correct key format manifestId:manifestVersion', () => {
    const entry = createSuspensionStackEntry({
      manifestId: AgentId('my-agent'),
      manifestVersion: '2.3.1',
    });

    const manifest = createAgentManifest('my-agent', '2.3.1');
    const manifestMap = new Map<ManifestKey, AgentManifest>([
      [ManifestKey(manifest.config), manifest],
    ]);

    const result = lookupManifest(entry, manifestMap);

    expect(result).toBe(manifest);
  });
});
