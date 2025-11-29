import type { Mock } from 'bun:test';

/**
 * Extracts method property keys from a type.
 * This excludes constructor, private methods, and non-function properties.
 */
export type MethodKeys<T> = {
  // biome-ignore lint/suspicious/noExplicitAny: required for generic type utility
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

/**
 * Extracts getter property keys from a type (properties that are not methods).
 * This includes all non-function properties which would include getters.
 */
export type GetterKeys<T> = {
  // biome-ignore lint/suspicious/noExplicitAny: required for generic type utility
  [K in keyof T]: T[K] extends (...args: any[]) => any ? never : K;
}[keyof T];

/**
 * Extracts all function/method and getter property keys from a type.
 */
export type FunctionAndGetterKeys<T> = MethodKeys<T> | GetterKeys<T>;

/**
 * Creates a type with methods and getters from a class instance.
 * This is equivalent to manually writing Pick<T, 'method1' | 'method2' | 'getter1' | ...
>
 * but automatically includes all public methods and getters.
 */
export type ExtractMethods<T> = Pick<T, FunctionAndGetterKeys<T>>;

/**
 * Transforms getter properties to mock functions that return their values.
 * This allows getters to be spy-able and mockable like methods.
 */
export type MockGetters<T> = {
  [K in GetterKeys<T>]: T[K];
};

/**
 * Transforms method types to their mocked equivalents with Bun test mock properties
 */
export type MockFunctions<T> = {
  [K in MethodKeys<T>]: T[K] extends (...args: infer Args) => infer Return
    ? Mock<(...args: Args) => Return>
    : never;
};

/**
 * Creates a type with all methods and getters transformed to their mocked equivalents.
 * Methods become Bun test mock functions, and getters become mock functions returning their values.
 */
export type ExtractMockMethods<T> = MockFunctions<T> & MockGetters<T>;
