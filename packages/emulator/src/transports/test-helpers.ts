/**
 * Shared test helpers for transport tests
 */

/**
 * Converts callback-style service vector methods to Promises for testing.
 *
 * This helper allows tests to work with both callback-style and Promise-style
 * service vector methods. It first attempts to call the method with a callback,
 * and falls back to Promise-style if that fails.
 *
 * @param method - The service vector method to call
 * @param args - Arguments to pass to the method (excluding the callback)
 * @returns Promise that resolves with the result or rejects with an error
 *
 * @example
 * ```typescript
 * const result = await callServiceVector<number[]>(
 *   capturedServiceVector.getHoldingRegister.bind(capturedServiceVector),
 *   0,
 *   1
 * )
 * ```
 */
export const callServiceVector = <T>(
  method: (...args: unknown[]) => unknown,
  ...args: unknown[]
): Promise<T> => {
  return new Promise((resolve, reject) => {
    // Try callback style first
    try {
       
      method(...args, (callbackErr: Error | null, result?: T) => {
        if (callbackErr) {
          reject(callbackErr)
        } else {
          resolve(result as T)
        }
      })
    } catch {
      // If that fails, maybe it's Promise-style
       
      const result = method(...args)
      if (result instanceof Promise) {
         
        result.then(resolve).catch(reject)
      } else {
        resolve(result as T)
      }
    }
  })
}
