'use client';

import { useAuthCookie, useLocalClient } from '@autoflow/client';
import { UserId, validStreamPart } from '@autoflow/core';
import { Button } from '@radix-ui/themes';
import { useCallback, useState } from 'react';

export function APITester() {
  const [responseText, setResponseText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingComplete, setStreamingComplete] = useState(false);

  const { requestAuthCookie } = useAuthCookie();
  const client = useLocalClient();

  const handleSubmit = useCallback(() => {
    requestAuthCookie(UserId('test-user-id'))
      .then((cookie) => {
        if (cookie.isErr()) {
          setResponseText(`Error: ${cookie.error.message}`);
          return;
        }
        setResponseText(`Auth cookie fetched successfully: ${cookie.value}`);
      })
      .catch((error) => {
        setResponseText(`Error fetching auth cookie: ${error}`);
      });
  }, [requestAuthCookie, setResponseText]);

  const handleHelloWorld = useCallback(() => {
    client
      .helloWorld()
      .then((response) => {
        if (response.isErr()) {
          setResponseText(
            `Error calling helloWorld: ${response.error.message}`,
          );
          return;
        }
        setResponseText(
          `Hello World response: ${JSON.stringify(response.value)}`,
        );
      })
      .catch((error) => {
        setResponseText(`Error calling helloWorld: ${error}`);
      });
  }, [client, setResponseText]);

  const streamingChatCompletionSimple = useCallback(async () => {
    setIsStreaming(true);
    setStreamingComplete(false);
    setResponseText('Starting simple stream...\n');

    try {
      const result = await client.streamingCompletion('Tell me a short story');

      if (result.isErr()) {
        setResponseText(`Error: ${result.error.message}`);
        setIsStreaming(false);
        return;
      }

      let fullContent = '';

      for await (const chunk of result.value) {
        if (chunk.type === 'chunk') {
          const validated = validStreamPart(chunk.content);
          if (validated.isErr()) {
            setResponseText(`Error: Invalid chunk content`);
            continue;
          }
          const content = validated.value;
          if (content.type === 'text-delta') {
            const textContent = content.text;
            fullContent += textContent;
            setResponseText((prev) => prev + textContent);
          }
          if (content.type === 'tool-call') {
            const toolCallContent = chunk.content;
            fullContent += `Tool call: ${JSON.stringify(toolCallContent)}\n`;
            setResponseText(
              (prev) =>
                `${prev}Tool call: ${JSON.stringify(toolCallContent)}\n`,
            );
          }
          if (content.type === 'tool-result') {
            fullContent += `Finish message: ${JSON.stringify(chunk.content)}\n`;
            setResponseText(
              (prev) =>
                `${prev}Finish message: ${JSON.stringify(chunk.content)}\n`,
            );
          }
        } else if (chunk.type === 'error') {
          setResponseText(`Error: ${chunk.message}`);
          break;
        } else if (chunk.type === 'complete') {
          setResponseText(`Complete: ${fullContent}`);
          break;
        }
      }
    } catch (error) {
      setResponseText(
        `Exception: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsStreaming(false);
      setStreamingComplete(true);
    }
  }, [client]);

  const handleStreamingChatCompletion = useCallback(() => {
    streamingChatCompletionSimple().catch((error) => {
      setResponseText(
        `Error during streaming: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }, [streamingChatCompletionSimple]);

  return (
    <div className="mt-8 mx-auto w-full max-w-2xl text-left flex flex-col gap-4">
      <div className="flex items-center gap-2 bg-card p-3 rounded-xl font-mono border border-input w-full flex-wrap">
        <Button onClick={handleHelloWorld} disabled={isStreaming}>
          Hello World
        </Button>

        <Button onClick={handleSubmit} disabled={isStreaming}>
          Auth Cookie
        </Button>

        <Button onClick={handleStreamingChatCompletion} disabled={isStreaming}>
          Stream (Simple)
        </Button>

        {streamingComplete && (
          <span className="text-green-600 text-sm">✓ Complete</span>
        )}
      </div>

      <textarea
        value={responseText}
        readOnly
        placeholder="Response will appear here..."
      />

      {isStreaming && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
          <span>Streaming in progress...</span>
        </div>
      )}
    </div>
  );
}
