import type { CaptureEvent } from '@autoflow/capture';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import type { Page } from 'playwright';

export interface ICaptureInjector {
  readonly inject: (page: Page) => Promise<Result<void, AppError>>;
  readonly collectEvents: (
    page: Page,
  ) => Promise<Result<readonly CaptureEvent[], AppError>>;
}

export { createCaptureInjector };

function createCaptureInjector(): ICaptureInjector {
  const instance = new CaptureInjector();
  return {
    inject: (page) => instance.inject(page),
    collectEvents: (page) => instance.collectEvents(page),
  };
}

const INJECT_SCRIPT = `
  window.__autoflow_capture_events = [];
  const observer = new MutationObserver((mutations) => {
    const events = window.__autoflow_capture_events;
    for (const mutation of mutations) {
      const isChildList = mutation.type === 'childList';
      const target = mutation.target;
      const isElement = target instanceof Element;
      events.push({
        id: crypto.randomUUID(),
        type: 'dom-change',
        timestamp: new Date().toISOString(),
        mutations: [{
          type: isChildList
            ? (mutation.addedNodes.length > 0 ? 'added' : 'removed')
            : 'modified',
          selector: isElement ? target.tagName.toLowerCase() : 'text',
          tagName: isElement ? target.tagName.toLowerCase() : '#text',
        }],
      });
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });
  window.__autoflow_capture_observer = observer;
`;

const COLLECT_SCRIPT = `
  if (window.__autoflow_capture_observer) {
    window.__autoflow_capture_observer.disconnect();
  }
  const events = window.__autoflow_capture_events || [];
  window.__autoflow_capture_events = [];
  events;
`;

class CaptureInjector implements ICaptureInjector {
  async inject(page: Page): Promise<Result<void, AppError>> {
    try {
      await page.addScriptTag({ content: INJECT_SCRIPT });
      return ok(undefined);
    } catch (error) {
      return err(
        internalError('Failed to inject capture scripts', {
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    }
  }

  async collectEvents(
    page: Page,
  ): Promise<Result<readonly CaptureEvent[], AppError>> {
    try {
      const rawEvents: unknown = await page.evaluate(COLLECT_SCRIPT);
      const events: CaptureEvent[] = Array.isArray(rawEvents) ? rawEvents : [];
      return ok(events);
    } catch (error) {
      return err(
        internalError('Failed to collect capture events', {
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    }
  }
}
