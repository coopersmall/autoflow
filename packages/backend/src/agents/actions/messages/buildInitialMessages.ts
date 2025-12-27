import type { AgentManifest, AgentRequest } from '@core/domain/agents';
import type { Message } from '@core/domain/ai';

/**
 * Builds the initial message array for an agent run.
 * Converts the request prompt (string or Message[]) into a Message array
 * and prepends the agent's system instructions.
 */
export function buildInitialMessages(
  manifest: AgentManifest,
  request: AgentRequest,
): Message[] {
  const messages: Message[] = [];

  // Add system message with agent instructions
  messages.push({
    role: 'system',
    content: manifest.config.instructions,
  });

  // Add user prompt
  if (typeof request.prompt === 'string') {
    messages.push({
      role: 'user',
      content: request.prompt,
    });
  } else {
    // Prompt is already Message[]
    messages.push(...request.prompt);
  }

  return messages;
}
