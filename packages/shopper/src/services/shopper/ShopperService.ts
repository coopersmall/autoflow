import type { CaptureEvent } from '@autoflow/capture';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import {
  generateMousePath,
  generateStepDelay,
  generateTypingDelays,
  normalRandom,
} from '@shopper/actions/humanBehavior';
import type { Scenario } from '@shopper/domain/Scenario';
import type { ShopperConfig } from '@shopper/domain/ShopperConfig';
import type { ShopperSession } from '@shopper/domain/ShopperSession';
import { ShopperSessionId } from '@shopper/domain/ShopperSessionId';
import type { StepResult } from '@shopper/domain/StepResult';
import { StepResultId } from '@shopper/domain/StepResultId';
import { createCaptureInjector } from '@shopper/services/capture/CaptureInjector';
import { err, ok, type Result } from 'neverthrow';
import { type Browser, chromium, type Page } from 'playwright';

export interface ShopperServiceConfig {
  readonly shopperConfig: ShopperConfig;
  readonly logger?: {
    debug(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
  };
}

export interface IShopperService {
  readonly executeScenario: (
    scenario: Scenario,
  ) => Promise<Result<ShopperSession, AppError>>;
}

export { createShopperService };

interface ShopperServiceDependencies {
  readonly createCaptureInject: typeof createCaptureInjector;
  readonly launchBrowser: typeof chromium.launch;
}

function createShopperService(
  config: ShopperServiceConfig,
  dependencies?: ShopperServiceDependencies,
): IShopperService {
  const instance = new ShopperService(config, dependencies);
  return {
    executeScenario: (scenario) => instance.executeScenario(scenario),
  };
}

class ShopperService implements IShopperService {
  constructor(
    private readonly config: ShopperServiceConfig,
    private readonly dependencies: ShopperServiceDependencies = {
      createCaptureInject: createCaptureInjector,
      launchBrowser: chromium.launch.bind(chromium),
    },
  ) {}

  async executeScenario(
    scenario: Scenario,
  ): Promise<Result<ShopperSession, AppError>> {
    const sessionId = ShopperSessionId();
    const startedAt = new Date();
    let browser: Browser | null = null;

    try {
      browser = await this.dependencies.launchBrowser({
        headless: this.config.shopperConfig.headless,
      });
      const page = await browser.newPage();

      this.config.logger?.debug('Navigating to target URL', {
        sessionId,
        targetUrl: scenario.targetUrl,
      });

      await page.goto(scenario.targetUrl, { waitUntil: 'networkidle' });

      const captureInjector = this.dependencies.createCaptureInject();
      const injectResult = await captureInjector.inject(page);
      if (injectResult.isErr()) {
        return err(injectResult.error);
      }

      const stepResults: StepResult[] = [];

      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];

        if (i > 0) {
          const delay = generateStepDelay(
            this.config.shopperConfig.delayBetweenSteps.minMs,
            this.config.shopperConfig.delayBetweenSteps.maxMs,
          );
          await this.sleep(delay);
        }

        const stepResult = await this.executeStep(page, step.message, i);
        stepResults.push(stepResult);

        this.config.logger?.debug('Step completed', {
          sessionId,
          stepIndex: i,
          status: stepResult.status,
        });
      }

      const eventsResult = await captureInjector.collectEvents(page);
      let capturedEvents: CaptureEvent[] = [];
      if (eventsResult.isOk()) {
        capturedEvents = [...eventsResult.value];
      } else {
        this.config.logger?.error('Failed to collect capture events', {
          error: eventsResult.error.message,
        });
      }

      await browser.close();
      browser = null;

      const session: ShopperSession = {
        schemaVersion: 1,
        id: sessionId,
        scenarioId: scenario.id,
        targetUrl: scenario.targetUrl,
        startedAt,
        endedAt: new Date(),
        stepResults,
        capturedEvents,
      };

      this.config.logger?.debug('Scenario execution completed', {
        sessionId,
        stepsCompleted: stepResults.length,
        eventsCollected: capturedEvents.length,
      });

      return ok(session);
    } catch (error) {
      if (browser) {
        await browser.close().catch(() => {
          // Intentionally swallowed — browser cleanup is best-effort
        });
      }
      return err(
        internalError('Scenario execution failed', {
          metadata: {
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    }
  }

  private async executeStep(
    page: Page,
    message: string,
    stepIndex: number,
  ): Promise<StepResult> {
    const stepStartedAt = new Date();

    try {
      const inputSelector = this.config.shopperConfig.inputSelector;
      const sendSelector = this.config.shopperConfig.sendSelector;
      const responseSelector = this.config.shopperConfig.responseSelector;

      await page.waitForSelector(inputSelector, { timeout: 10000 });
      const inputElement = await page.$(inputSelector);
      if (!inputElement) {
        return this.buildStepResult(stepIndex, message, stepStartedAt, {
          status: 'error',
          error: 'Chat input element not found',
        });
      }

      const inputBox = await inputElement.boundingBox();
      if (inputBox) {
        const path = generateMousePath(
          inputBox.x + inputBox.width / 2,
          inputBox.y + inputBox.height / 2,
          inputBox.x + inputBox.width / 2 + normalRandom(-5, 5),
          inputBox.y + inputBox.height / 2 + normalRandom(-5, 5),
          10,
        );
        for (const point of path) {
          await page.mouse.move(point.x, point.y);
          await this.sleep(normalRandom(5, 15));
        }
      }
      await inputElement.click();

      const delays = generateTypingDelays(
        message,
        this.config.shopperConfig.typingSpeed.minMs,
        this.config.shopperConfig.typingSpeed.maxMs,
      );
      for (let i = 0; i < message.length; i++) {
        await page.keyboard.type(message[i], { delay: 0 });
        await this.sleep(delays[i]);
      }

      const responseCountBefore = await page
        .$$(responseSelector)
        .then((els) => els.length);

      const sendButton = await page.$(sendSelector);
      if (sendButton) {
        await sendButton.click();
      } else {
        await page.keyboard.press('Enter');
      }

      let responseText: string | undefined;
      try {
        await page.waitForFunction(
          ({
            selector,
            countBefore,
          }: {
            selector: string;
            countBefore: number;
          }) => {
            const elements = document.querySelectorAll(selector);
            return elements.length > countBefore;
          },
          { selector: responseSelector, countBefore: responseCountBefore },
          { timeout: this.config.shopperConfig.responseTimeout },
        );

        const responses = await page.$$(responseSelector);
        const lastResponse = responses[responses.length - 1];
        if (lastResponse) {
          responseText = (await lastResponse.textContent()) ?? undefined;
        }
      } catch {
        return this.buildStepResult(stepIndex, message, stepStartedAt, {
          status: 'timeout',
          error: 'Timed out waiting for chat response',
        });
      }

      return this.buildStepResult(stepIndex, message, stepStartedAt, {
        status: 'success',
        responseReceived: responseText,
      });
    } catch (error) {
      return this.buildStepResult(stepIndex, message, stepStartedAt, {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private buildStepResult(
    stepIndex: number,
    messageSent: string,
    startedAt: Date,
    outcome: {
      readonly status: 'success' | 'timeout' | 'error';
      readonly responseReceived?: string;
      readonly error?: string;
    },
  ): StepResult {
    const completedAt = new Date();
    return {
      id: StepResultId(),
      stepIndex,
      messageSent,
      responseReceived: outcome.responseReceived,
      status: outcome.status,
      error: outcome.error,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
