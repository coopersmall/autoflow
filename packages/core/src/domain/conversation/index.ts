// === ORGANIZED EXPORTS ===

// Events (previously ItemEvent.ts - SPLIT INTO MULTIPLE FILES)
export * from './events';
// Conversation items (previously in root - BIGGEST CHANGE)
export * from './items';
// Shared types (previously in root)
export * from './shared';
// Step model (previously in root)
export * from './steps';

// === ROOT FILES (unchanged) ===

// Main entity
export * from './Conversation';

// === UTILITIES (unchanged) ===

// Converters, factories, helpers, validation
export * from './converters';
export * from './factories';
export * from './helpers';
export * from './validation';
