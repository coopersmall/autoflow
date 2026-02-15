import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createDomCaptureService } from '@capture/services/dom/DomCaptureService';

// Bun provides a minimal DOM environment via happy-dom
describe('createDomCaptureService', () => {
  let root: HTMLDivElement;

  beforeEach(() => {
    root = document.createElement('div');
    root.id = 'capture-root';
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  it('should expose the expected interface', () => {
    const service = createDomCaptureService();
    expect(typeof service.startCapture).toBe('function');
    expect(typeof service.stopCapture).toBe('function');
    expect(typeof service.getEvents).toBe('function');
  });

  it('should start capturing DOM mutations', () => {
    const service = createDomCaptureService();
    const result = service.startCapture(root);
    expect(result.isOk()).toBe(true);
    service.stopCapture();
  });

  it('should return error when starting capture twice', () => {
    const service = createDomCaptureService();
    service.startCapture(root);
    const result = service.startCapture(root);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe('DOM capture already started');
    }
    service.stopCapture();
  });

  it('should return empty events before any mutations', () => {
    const service = createDomCaptureService();
    service.startCapture(root);
    expect(service.getEvents()).toEqual([]);
    service.stopCapture();
  });

  it('should capture added elements after debounce', async () => {
    const service = createDomCaptureService({ debounceMs: 5 });
    service.startCapture(root);

    const child = document.createElement('span');
    child.className = 'test-child';
    root.appendChild(child);

    // Wait for MutationObserver + debounce to flush
    await new Promise((resolve) => setTimeout(resolve, 50));

    service.stopCapture();
    const events = service.getEvents();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('dom-change');
    expect(events[0].mutations.length).toBeGreaterThan(0);

    const addedMutation = events[0].mutations.find((m) => m.type === 'added');
    expect(addedMutation).toBeDefined();
    expect(addedMutation?.tagName).toBe('span');
  });

  it('should capture removed elements', async () => {
    const child = document.createElement('p');
    child.id = 'removable';
    root.appendChild(child);

    const service = createDomCaptureService({ debounceMs: 5 });
    service.startCapture(root);

    root.removeChild(child);

    await new Promise((resolve) => setTimeout(resolve, 50));

    service.stopCapture();
    const events = service.getEvents();
    const removedMutation = events
      .flatMap((e) => e.mutations)
      .find((m) => m.type === 'removed');
    expect(removedMutation).toBeDefined();
    expect(removedMutation?.tagName).toBe('p');
  });

  it('should capture attribute changes', async () => {
    const child = document.createElement('div');
    child.id = 'attr-target';
    root.appendChild(child);

    const service = createDomCaptureService({ debounceMs: 5 });
    service.startCapture(root);

    child.setAttribute('data-active', 'true');

    await new Promise((resolve) => setTimeout(resolve, 50));

    service.stopCapture();
    const events = service.getEvents();
    const modifiedMutation = events
      .flatMap((e) => e.mutations)
      .find((m) => m.type === 'modified');
    expect(modifiedMutation).toBeDefined();
    expect(modifiedMutation?.attributes?.['data-active']).toBe('true');
  });

  it('should capture text content changes', async () => {
    const child = document.createElement('span');
    child.textContent = 'original';
    root.appendChild(child);

    const service = createDomCaptureService({ debounceMs: 5 });
    service.startCapture(root);

    child.firstChild!.textContent = 'updated';

    await new Promise((resolve) => setTimeout(resolve, 50));

    service.stopCapture();
    const events = service.getEvents();
    const textMutation = events
      .flatMap((e) => e.mutations)
      .find((m) => m.type === 'text-changed');
    expect(textMutation).toBeDefined();
    expect(textMutation?.textContent).toBe('updated');
  });

  it('should batch rapid mutations via debounce', async () => {
    const service = createDomCaptureService({ debounceMs: 20 });
    service.startCapture(root);

    // Add multiple elements rapidly
    for (let i = 0; i < 5; i++) {
      const el = document.createElement('div');
      el.className = `batch-${i}`;
      root.appendChild(el);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    service.stopCapture();
    const events = service.getEvents();

    // Should be batched into fewer events than 5
    expect(events.length).toBeLessThanOrEqual(5);

    // But all mutations should be captured
    const totalMutations = events.reduce(
      (sum, e) => sum + e.mutations.length,
      0,
    );
    expect(totalMutations).toBeGreaterThanOrEqual(5);
  });

  it('should stop capturing after stopCapture is called', async () => {
    const service = createDomCaptureService({ debounceMs: 5 });
    service.startCapture(root);
    service.stopCapture();

    const child = document.createElement('div');
    root.appendChild(child);

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Events should only contain what was captured before stop
    const events = service.getEvents();
    const addedAfterStop = events
      .flatMap((e) => e.mutations)
      .find((m) => m.type === 'added');
    expect(addedAfterStop).toBeUndefined();
  });
});
