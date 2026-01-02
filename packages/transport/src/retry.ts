/**
 * Retry configuration and utilities for Modbus transport operations
 */

/** Maximum number of retry attempts for failed operations */
export const MAX_RETRIES = 3

/** Delay between retry attempts in milliseconds */
export const RETRY_DELAY_MS = 100

/**
 * Sleep for a specified duration
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function with fixed delay between attempts
 *
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of attempts (default: MAX_RETRIES)
 * @returns Promise resolving to the function's return value
 * @throws The last error encountered if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error = new Error('No retry attempts were made')

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        await sleep(RETRY_DELAY_MS)
      }
    }
  }

  throw lastError
}
