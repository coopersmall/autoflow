/**
 * Storage folder for agent binary content (e.g., images in conversation history).
 * Simple, flat structure for all agent-related files.
 */
export const AGENT_CONTENT_FOLDER = 'agents/content';

/**
 * TTL for agent binary content in storage.
 * Set longer than agent state TTL (24 hours) to handle edge cases.
 * Content is cleaned up via storage TTL, not explicitly by the agent framework.
 */
export const AGENT_CONTENT_TTL_SECONDS = 72 * 60 * 60; // 72 hours

/**
 * Expiry time for signed download URLs generated during deserialization.
 * Short-lived URLs are refreshed on each agent resume.
 */
export const AGENT_DOWNLOAD_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour

/**
 * Default TTL for agent state in cache.
 */
export const DEFAULT_AGENT_STATE_TTL = 24 * 60 * 60; // 24 hours

/**
 * Default agent execution timeout in milliseconds.
 * Measures active execution time, excluding time spent suspended.
 */
export const DEFAULT_AGENT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
