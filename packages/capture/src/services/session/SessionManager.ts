import type { CaptureSession } from '@capture/domain/CaptureSession';
import { CaptureSessionId } from '@capture/domain/CaptureSessionId';
import { EventId } from '@capture/domain/EventId';
import type { CaptureEvent } from '@capture/domain/events/CaptureEvent';
import type {
  UserActionEvent,
  UserActionType,
} from '@capture/domain/events/UserActionEvent';
import {
  createDomCaptureService,
  type DomCaptureServiceConfig,
  type IDomCaptureService,
} from '@capture/services/dom/DomCaptureService';
import {
  createNetworkInterceptor,
  type INetworkInterceptor,
  type NetworkInterceptorConfig,
} from '@capture/services/network/NetworkInterceptor';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';

export interface SessionManagerConfig {
  readonly domCaptureConfig?: DomCaptureServiceConfig;
  readonly networkInterceptorConfig?: NetworkInterceptorConfig;
  readonly logger?: {
    debug(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
  };
}

export interface ISessionManager {
  readonly startSession: (
    targetUrl: string,
    rootElement: Element,
    win: Window & typeof globalThis,
  ) => Result<CaptureSessionId, AppError>;
  readonly endSession: () => Result<CaptureSession, AppError>;
  readonly getCapturedSession: () => Result<CaptureSession, AppError>;
}

export { createSessionManager };

interface SessionManagerDependencies {
  readonly createDomCapture: typeof createDomCaptureService;
  readonly createNetworkIntercept: typeof createNetworkInterceptor;
}

function createSessionManager(
  config?: SessionManagerConfig,
  dependencies?: SessionManagerDependencies,
): ISessionManager {
  const instance = new SessionManager(config, dependencies);
  return {
    startSession: (targetUrl, rootElement, win) =>
      instance.startSession(targetUrl, rootElement, win),
    endSession: () => instance.endSession(),
    getCapturedSession: () => instance.getCapturedSession(),
  };
}

function buildSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }
  return element.tagName.toLowerCase();
}

class SessionManager implements ISessionManager {
  private sessionId: CaptureSessionId | null = null;
  private targetUrl: string | null = null;
  private startedAt: Date | null = null;
  private domCapture: IDomCaptureService | null = null;
  private networkInterceptor: INetworkInterceptor | null = null;
  private userActions: UserActionEvent[] = [];
  private boundHandlers: {
    click: EventListener;
    input: EventListener;
    submit: EventListener;
  } | null = null;
  private rootElement: Element | null = null;

  constructor(
    private readonly config?: SessionManagerConfig,
    private readonly dependencies: SessionManagerDependencies = {
      createDomCapture: createDomCaptureService,
      createNetworkIntercept: createNetworkInterceptor,
    },
  ) {}

  startSession(
    targetUrl: string,
    rootElement: Element,
    win: Window & typeof globalThis,
  ): Result<CaptureSessionId, AppError> {
    if (this.sessionId) {
      return err(internalError('Session already in progress'));
    }

    this.sessionId = CaptureSessionId();
    this.targetUrl = targetUrl;
    this.startedAt = new Date();
    this.rootElement = rootElement;

    this.domCapture = this.dependencies.createDomCapture(
      this.config?.domCaptureConfig,
    );
    const domResult = this.domCapture.startCapture(rootElement);
    if (domResult.isErr()) {
      this.resetState();
      return err(domResult.error);
    }

    this.networkInterceptor = this.dependencies.createNetworkIntercept(
      this.config?.networkInterceptorConfig,
    );
    const netResult = this.networkInterceptor.intercept(win);
    if (netResult.isErr()) {
      this.domCapture.stopCapture();
      this.resetState();
      return err(netResult.error);
    }

    this.attachUserActionListeners(rootElement);

    this.config?.logger?.debug('Capture session started', {
      sessionId: this.sessionId,
      targetUrl,
    });

    return ok(this.sessionId);
  }

  endSession(): Result<CaptureSession, AppError> {
    const session = this.buildSession(true);
    if (session.isErr()) {
      return err(session.error);
    }

    this.cleanup();
    return ok(session.value);
  }

  getCapturedSession(): Result<CaptureSession, AppError> {
    return this.buildSession(false);
  }

  private buildSession(ending: boolean): Result<CaptureSession, AppError> {
    if (!this.sessionId || !this.targetUrl || !this.startedAt) {
      return err(internalError('No active session'));
    }

    const events: CaptureEvent[] = [];

    if (this.domCapture) {
      events.push(...this.domCapture.getEvents());
    }

    if (this.networkInterceptor) {
      events.push(...this.networkInterceptor.getRequests());
    }

    events.push(...this.userActions);

    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const session: CaptureSession = {
      schemaVersion: 1,
      id: this.sessionId,
      targetUrl: this.targetUrl,
      startedAt: this.startedAt,
      ...(ending && { endedAt: new Date() }),
      events,
    };

    return ok(session);
  }

  private attachUserActionListeners(root: Element): void {
    const self = this;

    this.boundHandlers = {
      click(e: Event) {
        if (!(e instanceof MouseEvent)) {
          return;
        }
        const target = e.target;
        if (!(target instanceof Element)) {
          return;
        }
        self.userActions.push({
          id: EventId(),
          type: 'user-action',
          timestamp: new Date(),
          actionType: 'click' satisfies UserActionType,
          selector: buildSelector(target),
          tagName: target.tagName.toLowerCase(),
          coordinates: { x: e.clientX, y: e.clientY },
        });
      },
      input(e: Event) {
        const target = e.target;
        if (
          !(target instanceof HTMLInputElement) &&
          !(target instanceof HTMLTextAreaElement)
        ) {
          return;
        }
        self.userActions.push({
          id: EventId(),
          type: 'user-action',
          timestamp: new Date(),
          actionType: 'input' satisfies UserActionType,
          selector: buildSelector(target),
          tagName: target.tagName.toLowerCase(),
          value: target.value,
        });
      },
      submit(e: Event) {
        if (!(e instanceof SubmitEvent)) {
          return;
        }
        const target = e.target;
        if (!(target instanceof HTMLFormElement)) {
          return;
        }
        self.userActions.push({
          id: EventId(),
          type: 'user-action',
          timestamp: new Date(),
          actionType: 'submit' satisfies UserActionType,
          selector: buildSelector(target),
          tagName: target.tagName.toLowerCase(),
        });
      },
    };

    root.addEventListener('click', this.boundHandlers.click);
    root.addEventListener('input', this.boundHandlers.input);
    root.addEventListener('submit', this.boundHandlers.submit);
  }

  private cleanup(): void {
    if (this.domCapture) {
      this.domCapture.stopCapture();
    }

    if (this.networkInterceptor) {
      this.networkInterceptor.stopIntercepting();
    }

    if (this.rootElement && this.boundHandlers) {
      this.rootElement.removeEventListener('click', this.boundHandlers.click);
      this.rootElement.removeEventListener('input', this.boundHandlers.input);
      this.rootElement.removeEventListener('submit', this.boundHandlers.submit);
    }

    this.config?.logger?.debug('Capture session ended', {
      sessionId: this.sessionId,
    });

    this.resetState();
  }

  private resetState(): void {
    this.sessionId = null;
    this.targetUrl = null;
    this.startedAt = null;
    this.domCapture = null;
    this.networkInterceptor = null;
    this.userActions = [];
    this.boundHandlers = null;
    this.rootElement = null;
  }
}
