import { EventId } from '@capture/domain/EventId';
import type {
  DomChangeEvent,
  DomMutation,
  DomMutationType,
} from '@capture/domain/events/DomChangeEvent';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';

export interface DomCaptureServiceConfig {
  readonly debounceMs?: number;
  readonly logger?: {
    debug(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
  };
}

export interface IDomCaptureService {
  readonly startCapture: (rootElement: Element) => Result<void, AppError>;
  readonly stopCapture: () => void;
  readonly getEvents: () => ReadonlyArray<DomChangeEvent>;
}

export { createDomCaptureService };

function createDomCaptureService(
  config?: DomCaptureServiceConfig,
): IDomCaptureService {
  const instance = new DomCaptureService(config);
  return {
    startCapture: (rootElement) => instance.startCapture(rootElement),
    stopCapture: () => instance.stopCapture(),
    getEvents: () => instance.getEvents(),
  };
}

function buildSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).slice(0, 2);
      if (classes.length > 0 && classes[0] !== '') {
        selector += `.${classes.join('.')}`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

function detectShadowRoot(element: Element): 'open' | 'closed' | 'none' {
  if (element.shadowRoot) {
    return 'open';
  }
  // If there's no shadowRoot property but the element is a custom element,
  // it might have a closed shadow root
  if (element.tagName.includes('-') && !element.shadowRoot) {
    return 'closed';
  }
  return 'none';
}

function traverseShadowRoots(root: Element, observer: MutationObserver): void {
  if (root.shadowRoot) {
    observer.observe(root.shadowRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeOldValue: true,
    });

    for (const child of root.shadowRoot.querySelectorAll('*')) {
      traverseShadowRoots(child, observer);
    }
  }

  for (const child of root.querySelectorAll('*')) {
    if (child.shadowRoot) {
      traverseShadowRoots(child, observer);
    }
  }
}

class DomCaptureService implements IDomCaptureService {
  private observer: MutationObserver | null = null;
  private events: DomChangeEvent[] = [];
  private pendingMutations: DomMutation[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;

  constructor(private readonly config?: DomCaptureServiceConfig) {
    this.debounceMs = config?.debounceMs ?? 16;
  }

  startCapture(rootElement: Element): Result<void, AppError> {
    if (this.observer) {
      return err(internalError('DOM capture already started'));
    }

    this.observer = new MutationObserver((mutations: MutationRecord[]) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(rootElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeOldValue: true,
    });

    traverseShadowRoots(rootElement, this.observer);

    this.config?.logger?.debug('DOM capture started', {
      rootSelector: buildSelector(rootElement),
    });

    return ok(undefined);
  }

  stopCapture(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.flush();

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    this.config?.logger?.debug('DOM capture stopped', {
      totalEvents: this.events.length,
    });
  }

  getEvents(): ReadonlyArray<DomChangeEvent> {
    return this.events;
  }

  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      const target = mutation.target;

      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            const shadowRootMode = detectShadowRoot(node);
            this.pendingMutations.push({
              type: 'added',
              selector: buildSelector(node),
              tagName: node.tagName.toLowerCase(),
              ...(shadowRootMode !== 'none' && {
                shadowRoot: shadowRootMode,
              }),
            });

            // Observe newly added open shadow roots
            if (node.shadowRoot && this.observer) {
              traverseShadowRoots(node, this.observer);
            }
          }
        }

        for (const node of mutation.removedNodes) {
          if (node instanceof Element) {
            this.pendingMutations.push({
              type: 'removed',
              selector: buildSelector(node),
              tagName: node.tagName.toLowerCase(),
            });
          }
        }
      }

      if (mutation.type === 'attributes' && target instanceof Element) {
        const attrName = mutation.attributeName;
        if (attrName) {
          this.pendingMutations.push({
            type: 'modified' satisfies DomMutationType,
            selector: buildSelector(target),
            tagName: target.tagName.toLowerCase(),
            attributes: {
              [attrName]: target.getAttribute(attrName) ?? '',
            },
          });
        }
      }

      if (mutation.type === 'characterData' && target.parentElement) {
        this.pendingMutations.push({
          type: 'text-changed' satisfies DomMutationType,
          selector: buildSelector(target.parentElement),
          tagName: target.parentElement.tagName.toLowerCase(),
          textContent: target.textContent ?? '',
        });
      }
    }

    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flush();
      this.flushTimer = null;
    }, this.debounceMs);
  }

  private flush(): void {
    if (this.pendingMutations.length === 0) {
      return;
    }

    const event: DomChangeEvent = {
      id: EventId(),
      type: 'dom-change',
      timestamp: new Date(),
      mutations: [...this.pendingMutations],
    };

    this.events.push(event);
    this.pendingMutations = [];
  }
}
