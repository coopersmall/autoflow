import zod from 'zod';

export const shopperConfigSchema = zod.object({
  typingSpeed: zod
    .object({
      minMs: zod
        .number()
        .min(10)
        .default(50)
        .describe('minimum milliseconds per character'),
      maxMs: zod
        .number()
        .min(10)
        .default(150)
        .describe('maximum milliseconds per character'),
    })
    .default({})
    .describe('typing speed range for human-like input'),
  delayBetweenSteps: zod
    .object({
      minMs: zod
        .number()
        .min(0)
        .default(1000)
        .describe('minimum delay between steps in milliseconds'),
      maxMs: zod
        .number()
        .min(0)
        .default(5000)
        .describe('maximum delay between steps in milliseconds'),
    })
    .default({})
    .describe('delay range between scenario steps'),
  responseTimeout: zod
    .number()
    .min(1000)
    .default(30000)
    .describe('maximum time to wait for a chat response in milliseconds'),
  chatWidgetSelector: zod
    .string()
    .default('[data-testid="chat-widget"]')
    .describe('CSS selector for the chat widget container'),
  inputSelector: zod
    .string()
    .default('textarea, input[type="text"]')
    .describe('CSS selector for the chat input field'),
  sendSelector: zod
    .string()
    .default('button[type="submit"]')
    .describe('CSS selector for the send button'),
  responseSelector: zod
    .string()
    .default('[data-testid="chat-response"]')
    .describe('CSS selector for chat response elements'),
  headless: zod
    .boolean()
    .default(true)
    .describe('whether to run the browser in headless mode'),
});
export type ShopperConfig = zod.infer<typeof shopperConfigSchema>;
