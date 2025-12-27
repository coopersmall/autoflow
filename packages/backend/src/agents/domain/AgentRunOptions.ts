/**
 * Represents configuration options for running an agent
 */
export type AgentRunOptions = {
  /**
   * Custom storage folder for agent binary content (e.g., images).
   * Defaults to AGENT_CONTENT_FOLDER.
   */
  agentContentFolder?: string;

  /**
   * Custom TTL for agent binary content in storage in seconds.
   * Defaults to AGENT_CONTENT_TTL_SECONDS.
   */
  agentContentTtlSeconds?: number;

  /**
   * Custom expiry time for signed download URLs in seconds.
   * Defaults to AGENT_DOWNLOAD_URL_EXPIRY_SECONDS.
   */
  agentDownloadUrlExpirySeconds?: number;

  /**
   * Custom TTL for agent state in seconds.
   * Defaults to DEFAULT_AGENT_STATE_TTL.
   */
  agentStateTtl?: number;

  /**
   * Custom agent execution timeout in milliseconds.
   * Defaults to DEFAULT_AGENT_TIMEOUT.
   */
  agentTimeout?: number;
};
