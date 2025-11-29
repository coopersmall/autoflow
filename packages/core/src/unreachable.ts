/**
 * A utility function that takes a value of type `never` and returns it.
 * Used for exhaustive type checking in TypeScript.
 *
 * @param value - The value of type `never`.
 * @returns The same value of type `never`.
 *
 * @example
 *  type Shape = 'circle' | 'square';
 *  function getArea(shape: Shape): number {
 *    switch (shape) {
 *      case 'circle':
 *        return Math.PI * 1 * 1;
 *      case 'square':
 *        return 1 * 1;
 *      default:
 *        return unreachable(shape); // Ensures all cases are handled
 *    }
 *  }
 */
export function unreachable(value: never): never {
  return value;
}
