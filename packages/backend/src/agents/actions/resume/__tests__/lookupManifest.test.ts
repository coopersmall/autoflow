import { describe, expect, it } from 'bun:test';
import { AgentId } from '@autoflow/core';
import { lookupManifest } from '../lookupManifest';
import { createAgentManifest, createSuspensionStackEntry } from './fixtures';

describe('lookupManifest', () => {
  it('should return manifest when found', () => {
    const entry = createSuspensionStackEntry({
      manifestId: AgentId('test-agent'),
      manifestVersion: '1.0.0',
    });

    const manifest = createAgentManifest('test-agent', '1.0.0');
    const manifestMap = new Map([['test-agent:1.0.0', manifest]]);

    const result = lookupManifest(entry, manifestMap);

    expect(result).toBe(manifest);
  });

  it('should return undefined when manifest not found', () => {
    const entry = createSuspensionStackEntry({
      manifestId: AgentId('test-agent'),
      manifestVersion: '1.0.0',
    });

    const manifestMap = new Map<
      string,
      ReturnType<typeof createAgentManifest>
    >();

    const result = lookupManifest(entry, manifestMap);

    expect(result).toBeUndefined();
  });

  it('should use correct key format manifestId:manifestVersion', () => {
    const entry = createSuspensionStackEntry({
      manifestId: AgentId('my-agent'),
      manifestVersion: '2.3.1',
    });

    const manifest = createAgentManifest('my-agent', '2.3.1');
    const manifestMap = new Map([['my-agent:2.3.1', manifest]]);

    const result = lookupManifest(entry, manifestMap);

    expect(result).toBe(manifest);
  });
});
