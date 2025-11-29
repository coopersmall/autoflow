/**
 * Port pool manager for HTTP integration tests.
 *
 * Manages allocation of ports to ensure each test file gets a unique port.
 * Prevents port conflicts by tracking used ports across the entire test suite.
 *
 * IMPORTANT: Ports should NOT be released during a test run. Bun's HTTP server
 * doesn't fully release the socket immediately after stop(), so if another test
 * file acquires the same port and starts a new server, it may fail silently.
 * The port range (14000-15999) provides 2000 ports which is sufficient for any
 * practical test suite.
 *
 * Usage:
 * ```typescript
 * beforeAll(() => {
 *   port = TestPortPool.acquire();
 * });
 *
 * // NOTE: Do not call release() in afterAll - let the port remain allocated
 * // for the duration of the test run to avoid port reuse issues.
 * ```
 */
export class TestPortPool {
  private static usedPorts = new Set<number>();
  private static readonly BASE_PORT = 14000;
  private static readonly MAX_PORT = 15999;
  private static readonly RESERVED_PORTS = new Set([
    5433, // Test PostgreSQL database
    6380, // Test Redis cache
  ]);

  /**
   * Acquires an available port from the pool.
   * Searches linearly from BASE_PORT to MAX_PORT, skipping reserved and used ports.
   *
   * @returns Available port number
   * @throws Error if no ports available in range (shouldn't happen in practice)
   *
   * @example
   * const port = TestPortPool.acquire(); // e.g., 9000
   */
  static acquire(): number {
    for (
      let port = TestPortPool.BASE_PORT;
      port <= TestPortPool.MAX_PORT;
      port++
    ) {
      if (TestPortPool.RESERVED_PORTS.has(port)) {
        continue;
      }

      if (!TestPortPool.usedPorts.has(port)) {
        TestPortPool.usedPorts.add(port);
        return port;
      }
    }

    // biome-ignore lint: In practice this should never happen with the given port range
    throw new Error('No available ports in the test port pool range');
  }

  /**
   * Releases a port back to the pool for reuse.
   *
   * WARNING: Do not call this during normal test execution. Bun's HTTP server
   * doesn't fully release the socket immediately after stop(), causing issues
   * when the same port is reused by another test file. Only use this method
   * for special cases like manual cleanup or debugging.
   *
   * @param port - Port number to release
   *
   * @example
   * // Generally avoid calling this in tests
   * TestPortPool.release(9000);
   */
  static release(port: number): void {
    TestPortPool.usedPorts.delete(port);
  }

  /**
   * Resets the entire port pool, releasing all ports.
   * Useful for test suite cleanup or debugging.
   *
   * @example
   * TestPortPool.reset(); // All ports now available
   */
  static reset(): void {
    TestPortPool.usedPorts.clear();
  }

  /**
   * Returns the number of currently allocated ports.
   * Useful for debugging port exhaustion issues.
   *
   * @returns Number of ports currently in use
   *
   * @example
   * console.log(`Using ${TestPortPool.getUsedCount()} ports`);
   */
  static getUsedCount(): number {
    return TestPortPool.usedPorts.size;
  }
}
