import { GlobalWindow } from 'happy-dom';

const window = new GlobalWindow();

const globals = [
  'document',
  'HTMLElement',
  'HTMLDivElement',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'HTMLFormElement',
  'Element',
  'Node',
  'MutationObserver',
  'Event',
  'MouseEvent',
  'SubmitEvent',
  'Headers',
  'Response',
  'Request',
  'ReadableStream',
  'TextEncoder',
  'TextDecoder',
  'XMLHttpRequest',
  'CustomEvent',
] as const;

for (const key of globals) {
  if (key in window && !(key in globalThis)) {
    // biome-ignore lint: Need to register DOM globals for testing
    (globalThis as any)[key] = (window as any)[key];
  }
}

if (!('window' in globalThis)) {
  // biome-ignore lint: Need to register window global for testing
  (globalThis as any).window = window;
}

if (!('document' in globalThis)) {
  // biome-ignore lint: Need to register document global for testing
  (globalThis as any).document = window.document;
}
