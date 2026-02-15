import { describe, expect, it } from 'bun:test';
import { validate } from '@core/validation/validate';
import { scenarioSchema } from '@shopper/domain/Scenario';
import { ScenarioId } from '@shopper/domain/ScenarioId';
import { shopperConfigSchema } from '@shopper/domain/ShopperConfig';
import { shopperSessionSchema } from '@shopper/domain/ShopperSession';
import { ShopperSessionId } from '@shopper/domain/ShopperSessionId';
import { stepResultSchema } from '@shopper/domain/StepResult';
import { StepResultId } from '@shopper/domain/StepResultId';

describe('ScenarioId', () => {
  it('should generate a unique id', () => {
    const id = ScenarioId();
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should accept a predefined value', () => {
    const id = ScenarioId('my-scenario-id');
    expect(id as string).toBe('my-scenario-id');
  });

  it('should generate unique ids each time', () => {
    const id1 = ScenarioId();
    const id2 = ScenarioId();
    expect(id1).not.toBe(id2);
  });
});

describe('ShopperSessionId', () => {
  it('should generate a unique id', () => {
    const id = ShopperSessionId();
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('StepResultId', () => {
  it('should generate a unique id', () => {
    const id = StepResultId();
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('Scenario schema', () => {
  it('should validate a valid scenario', () => {
    const scenario = {
      schemaVersion: 1 as const,
      id: ScenarioId(),
      name: 'Test greeting flow',
      targetUrl: 'https://chat.example.com',
      steps: [
        {
          message: 'Hello, how are you?',
          expectedBehaviors: ['should respond with greeting'],
        },
      ],
    };

    const result = validate(scenarioSchema, scenario);
    expect(result.isOk()).toBe(true);
  });

  it('should validate a scenario with multiple steps', () => {
    const scenario = {
      schemaVersion: 1 as const,
      id: ScenarioId(),
      name: 'Multi-step conversation',
      targetUrl: 'https://chat.example.com',
      steps: [
        { message: 'Hi there' },
        { message: 'What can you help me with?' },
        { message: 'Tell me about your products' },
      ],
    };

    const result = validate(scenarioSchema, scenario);
    expect(result.isOk()).toBe(true);
  });

  it('should reject a scenario with empty steps', () => {
    const scenario = {
      schemaVersion: 1 as const,
      id: ScenarioId(),
      name: 'Empty scenario',
      targetUrl: 'https://chat.example.com',
      steps: [] as never[],
    };

    const result = validate(scenarioSchema, scenario);
    expect(result.isErr()).toBe(true);
  });

  it('should reject a scenario with invalid URL', () => {
    const scenario = {
      schemaVersion: 1 as const,
      id: ScenarioId(),
      name: 'Bad URL scenario',
      targetUrl: 'not-a-url',
      steps: [{ message: 'Hello' }],
    };

    const result = validate(scenarioSchema, scenario);
    expect(result.isErr()).toBe(true);
  });

  it('should reject a scenario with empty name', () => {
    const scenario = {
      schemaVersion: 1 as const,
      id: ScenarioId(),
      name: '',
      targetUrl: 'https://chat.example.com',
      steps: [{ message: 'Hello' }],
    };

    const result = validate(scenarioSchema, scenario);
    expect(result.isErr()).toBe(true);
  });

  it('should reject a step with empty message', () => {
    const scenario = {
      schemaVersion: 1 as const,
      id: ScenarioId(),
      name: 'Empty message',
      targetUrl: 'https://chat.example.com',
      steps: [{ message: '' }],
    };

    const result = validate(scenarioSchema, scenario);
    expect(result.isErr()).toBe(true);
  });

  it('should reject invalid schema version', () => {
    const scenario = {
      schemaVersion: 2,
      id: ScenarioId(),
      name: 'Wrong version',
      targetUrl: 'https://chat.example.com',
      steps: [{ message: 'Hello' }],
    };

    const result = validate(scenarioSchema, scenario as any);
    expect(result.isErr()).toBe(true);
  });
});

describe('ShopperConfig schema', () => {
  it('should validate with all defaults', () => {
    const result = validate(shopperConfigSchema, {});
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.typingSpeed.minMs).toBe(50);
      expect(result.value.typingSpeed.maxMs).toBe(150);
      expect(result.value.delayBetweenSteps.minMs).toBe(1000);
      expect(result.value.delayBetweenSteps.maxMs).toBe(5000);
      expect(result.value.responseTimeout).toBe(30000);
      expect(result.value.headless).toBe(true);
    }
  });

  it('should validate with custom values', () => {
    const config = {
      typingSpeed: { minMs: 30, maxMs: 100 },
      delayBetweenSteps: { minMs: 500, maxMs: 2000 },
      responseTimeout: 60000,
      chatWidgetSelector: '#my-widget',
      inputSelector: '#chat-input',
      sendSelector: '#send-btn',
      responseSelector: '.bot-message',
      headless: false,
    };

    const result = validate(shopperConfigSchema, config);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.typingSpeed.minMs).toBe(30);
      expect(result.value.headless).toBe(false);
      expect(result.value.inputSelector).toBe('#chat-input');
    }
  });

  it('should reject typing speed below minimum', () => {
    const config = {
      typingSpeed: { minMs: 5, maxMs: 100 },
    };

    const result = validate(shopperConfigSchema, config);
    expect(result.isErr()).toBe(true);
  });

  it('should reject response timeout below minimum', () => {
    const config = {
      responseTimeout: 500,
    };

    const result = validate(shopperConfigSchema, config);
    expect(result.isErr()).toBe(true);
  });
});

describe('StepResult schema', () => {
  it('should validate a successful step result', () => {
    const now = new Date();
    const stepResult = {
      id: StepResultId(),
      stepIndex: 0,
      messageSent: 'Hello, how are you?',
      responseReceived: 'I am doing well, thank you!',
      status: 'success' as const,
      startedAt: now,
      completedAt: new Date(now.getTime() + 5000),
      durationMs: 5000,
    };

    const result = validate(stepResultSchema, stepResult);
    expect(result.isOk()).toBe(true);
  });

  it('should validate a timeout step result', () => {
    const now = new Date();
    const stepResult = {
      id: StepResultId(),
      stepIndex: 1,
      messageSent: 'Are you there?',
      status: 'timeout' as const,
      error: 'Timed out waiting for chat response',
      startedAt: now,
      completedAt: new Date(now.getTime() + 30000),
      durationMs: 30000,
    };

    const result = validate(stepResultSchema, stepResult);
    expect(result.isOk()).toBe(true);
  });

  it('should validate an error step result', () => {
    const now = new Date();
    const stepResult = {
      id: StepResultId(),
      stepIndex: 0,
      messageSent: 'Hello',
      status: 'error' as const,
      error: 'Chat input element not found',
      startedAt: now,
      completedAt: new Date(now.getTime() + 100),
      durationMs: 100,
    };

    const result = validate(stepResultSchema, stepResult);
    expect(result.isOk()).toBe(true);
  });

  it('should reject invalid status', () => {
    const now = new Date();
    const stepResult = {
      id: StepResultId(),
      stepIndex: 0,
      messageSent: 'Hello',
      status: 'unknown',
      startedAt: now,
      completedAt: now,
      durationMs: 0,
    };

    const result = validate(stepResultSchema, stepResult as any);
    expect(result.isErr()).toBe(true);
  });

  it('should reject negative step index', () => {
    const now = new Date();
    const stepResult = {
      id: StepResultId(),
      stepIndex: -1,
      messageSent: 'Hello',
      status: 'success' as const,
      startedAt: now,
      completedAt: now,
      durationMs: 0,
    };

    const result = validate(stepResultSchema, stepResult);
    expect(result.isErr()).toBe(true);
  });
});

describe('ShopperSession schema', () => {
  it('should validate a valid session', () => {
    const now = new Date();
    const session = {
      schemaVersion: 1 as const,
      id: ShopperSessionId(),
      scenarioId: ScenarioId(),
      targetUrl: 'https://chat.example.com',
      startedAt: now,
      stepResults: [],
      capturedEvents: [],
    };

    const result = validate(shopperSessionSchema, session);
    expect(result.isOk()).toBe(true);
  });

  it('should validate a session with endedAt', () => {
    const now = new Date();
    const session = {
      schemaVersion: 1 as const,
      id: ShopperSessionId(),
      scenarioId: ScenarioId(),
      targetUrl: 'https://chat.example.com',
      startedAt: now,
      endedAt: new Date(now.getTime() + 60000),
      stepResults: [],
      capturedEvents: [],
    };

    const result = validate(shopperSessionSchema, session);
    expect(result.isOk()).toBe(true);
  });

  it('should validate a session with step results', () => {
    const now = new Date();
    const session = {
      schemaVersion: 1 as const,
      id: ShopperSessionId(),
      scenarioId: ScenarioId(),
      targetUrl: 'https://chat.example.com',
      startedAt: now,
      endedAt: new Date(now.getTime() + 60000),
      stepResults: [
        {
          id: StepResultId(),
          stepIndex: 0,
          messageSent: 'Hello',
          responseReceived: 'Hi there!',
          status: 'success' as const,
          startedAt: now,
          completedAt: new Date(now.getTime() + 5000),
          durationMs: 5000,
        },
      ],
      capturedEvents: [],
    };

    const result = validate(shopperSessionSchema, session);
    expect(result.isOk()).toBe(true);
  });

  it('should reject invalid schema version', () => {
    const session = {
      schemaVersion: 2,
      id: ShopperSessionId(),
      scenarioId: ScenarioId(),
      targetUrl: 'https://chat.example.com',
      startedAt: new Date(),
      stepResults: [],
      capturedEvents: [],
    };

    const result = validate(shopperSessionSchema, session as any);
    expect(result.isErr()).toBe(true);
  });

  it('should reject invalid target URL', () => {
    const session = {
      schemaVersion: 1 as const,
      id: ShopperSessionId(),
      scenarioId: ScenarioId(),
      targetUrl: 'not-a-url',
      startedAt: new Date(),
      stepResults: [],
      capturedEvents: [],
    };

    const result = validate(shopperSessionSchema, session);
    expect(result.isErr()).toBe(true);
  });
});
