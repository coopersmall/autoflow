/**
 * Consumes an async generator, discarding all yielded values,
 * and returns only the final return value.
 *
 * This is used to convert streaming functions into non-streaming ones.
 * The streaming function yields events during execution, but the
 * non-streaming caller only cares about the final result.
 *
 * @example
 * ```ts
 * // Streaming version yields events
 * const generator = streamAgentLoop(params, deps);
 *
 * // Non-streaming version discards events, returns final result
 * const result = await consumeGenerator(generator);
 * ```
 *
 * @param generator - The async generator to consume
 * @returns The final return value from the generator
 */
export async function consumeGenerator<T, R>(
  generator: AsyncGenerator<T, R>,
): Promise<R> {
  let result: IteratorResult<T, R>;
  do {
    result = await generator.next();
  } while (!result.done);
  return result.value;
}
