import { withRetry, MAX_RETRIES, RETRY_DELAY_MS } from './retry.js'

describe('withRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('should succeed on first attempt without calling logger', async () => {
    const logger = jest.fn()
    const operation = jest.fn().mockResolvedValue('success')

    const promise = withRetry(operation, MAX_RETRIES, logger)
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(1)
    expect(logger).not.toHaveBeenCalled()
  })

  test('should call logger on retry attempts', async () => {
    const logger = jest.fn()
    const error1 = new Error('Connection reset')
    const error2 = new Error('Timeout')
    const operation = jest
      .fn()
      .mockRejectedValueOnce(error1)
      .mockRejectedValueOnce(error2)
      .mockResolvedValueOnce('success')

    const promise = withRetry(operation, MAX_RETRIES, logger)
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(3)
    expect(logger).toHaveBeenCalledTimes(2)
    expect(logger).toHaveBeenNthCalledWith(1, 1, error1)
    expect(logger).toHaveBeenNthCalledWith(2, 2, error2)
  })

  test('should call logger for all failed attempts', async () => {
    const logger = jest.fn()
    const error = new Error('Network unreachable')
    const operation = jest.fn().mockRejectedValue(error)

    const promise = withRetry(operation, MAX_RETRIES, logger)

    // Need to catch the rejection to prevent unhandled promise
    const resultPromise = promise.catch((err) => err)
    await jest.runAllTimersAsync()
    const result = await resultPromise

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('Network unreachable')
    expect(operation).toHaveBeenCalledTimes(MAX_RETRIES)
    expect(logger).toHaveBeenCalledTimes(MAX_RETRIES - 1)
    expect(logger).toHaveBeenNthCalledWith(1, 1, error)
    expect(logger).toHaveBeenNthCalledWith(2, 2, error)
  })

  test('should work without logger (backward compatibility)', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('Transient error'))
      .mockResolvedValueOnce('success')

    const promise = withRetry(operation, MAX_RETRIES)
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('success')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  test('should respect custom maxRetries with logger', async () => {
    const logger = jest.fn()
    const error = new Error('Failed')
    const operation = jest.fn().mockRejectedValue(error)

    const promise = withRetry(operation, 5, logger)

    // Need to catch the rejection to prevent unhandled promise
    const resultPromise = promise.catch((err) => err)
    await jest.runAllTimersAsync()
    const result = await resultPromise

    expect(result).toBeInstanceOf(Error)
    expect(result.message).toBe('Failed')
    expect(operation).toHaveBeenCalledTimes(5)
    expect(logger).toHaveBeenCalledTimes(4)
  })

  test('should provide correct attempt numbers to logger', async () => {
    const logger = jest.fn()
    const error = new Error('Error')
    const operation = jest
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('success')

    const promise = withRetry(operation, 4, logger)
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('success')
    expect(logger).toHaveBeenCalledTimes(3)
    expect(logger).toHaveBeenNthCalledWith(1, 1, error)
    expect(logger).toHaveBeenNthCalledWith(2, 2, error)
    expect(logger).toHaveBeenNthCalledWith(3, 3, error)
  })

  test('should delay between retry attempts', async () => {
    const logger = jest.fn()
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error('Error'))
      .mockResolvedValueOnce('success')

    const promise = withRetry(operation, MAX_RETRIES, logger)

    // First attempt fails immediately
    await Promise.resolve()
    expect(operation).toHaveBeenCalledTimes(1)
    expect(logger).toHaveBeenCalledTimes(1)

    // Advance timers by RETRY_DELAY_MS
    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS)

    // Second attempt should now execute
    expect(operation).toHaveBeenCalledTimes(2)

    const result = await promise
    expect(result).toBe('success')
  })
})
