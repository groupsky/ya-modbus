import { ProgressTracker } from './progress.js'

describe('ProgressTracker', () => {
  let originalDateNow: typeof Date.now

  beforeEach(() => {
    // Mock Date.now for predictable time-based testing
    originalDateNow = Date.now
    let mockTime = 1000000 // Start at 1,000,000ms
    Date.now = jest.fn(() => mockTime)

    // Helper to advance time
    ;(global as typeof globalThis & { advanceTime: (ms: number) => void }).advanceTime = (
      ms: number
    ) => {
      mockTime += ms
    }
  })

  afterEach(() => {
    Date.now = originalDateNow
    delete (global as typeof globalThis & { advanceTime?: (ms: number) => void }).advanceTime
  })

  const advanceTime = (ms: number): void => {
    ;(global as typeof globalThis & { advanceTime: (ms: number) => void }).advanceTime(ms)
  }

  describe('constructor', () => {
    test('initializes with total combinations', () => {
      const tracker = new ProgressTracker(1000)
      expect(tracker).toBeDefined()
    })
  })

  describe('update', () => {
    test('returns progress string on first update', () => {
      const tracker = new ProgressTracker(1000)

      const result = tracker.update(100, 0)

      expect(result).toMatch(/Progress: 10%/)
      expect(result).toMatch(/100\/1000/)
      expect(result).toMatch(/Devices found: 0/)
      expect(result).toMatch(/Elapsed: 0s/)
    })

    test('includes ETA when progress > 0 and not completed', () => {
      const tracker = new ProgressTracker(1000)

      // Advance time by 10 seconds
      advanceTime(10000)

      const result = tracker.update(100, 0)

      // At 100/1000 after 10s, rate = 10 items/s, remaining = 900, ETA = 90s
      expect(result).toMatch(/ETA: 1m 30s/)
    })

    test('does not include ETA when at 0% progress', () => {
      const tracker = new ProgressTracker(1000)

      const result = tracker.update(0, 0)

      expect(result).not.toMatch(/ETA/)
    })

    test('does not include ETA when elapsed time is 0 (prevents division by zero)', () => {
      const tracker = new ProgressTracker(1000)

      // Don't advance time - elapsed is 0
      const result = tracker.update(100, 0)

      // Should not attempt to calculate ETA when elapsed is 0 (would cause division by zero)
      expect(result).not.toMatch(/ETA/)
      expect(result).toMatch(/Progress: 10%/)
      expect(result).toMatch(/Elapsed: 0s/)
    })

    test('does not include ETA when at 100% progress', () => {
      const tracker = new ProgressTracker(1000)

      advanceTime(10000)

      const result = tracker.update(1000, 5)

      expect(result).toMatch(/Progress: 100%/)
      expect(result).not.toMatch(/ETA/)
    })

    test('returns null when throttled (< 1 second since last update)', () => {
      const tracker = new ProgressTracker(1000)

      // First update succeeds
      const first = tracker.update(100, 0)
      expect(first).not.toBeNull()

      // Advance only 500ms (less than 1 second throttle)
      advanceTime(500)

      // Second update should be throttled
      const second = tracker.update(200, 0)
      expect(second).toBeNull()
    })

    test('returns update after throttle interval passes', () => {
      const tracker = new ProgressTracker(1000)

      tracker.update(100, 0)

      // Advance 1000ms (exactly the throttle interval)
      advanceTime(1000)

      const result = tracker.update(200, 0)
      expect(result).not.toBeNull()
      expect(result).toMatch(/Progress: 20%/)
    })

    test('always returns update on completion (even if throttled)', () => {
      const tracker = new ProgressTracker(1000)

      tracker.update(100, 0)

      // Advance only 500ms (should be throttled normally)
      advanceTime(500)

      // But completion should not be throttled
      const result = tracker.update(1000, 5)
      expect(result).not.toBeNull()
      expect(result).toMatch(/Progress: 100%/)
    })

    test('calculates percentage correctly', () => {
      const tracker = new ProgressTracker(1000)

      expect(tracker.update(0, 0)).toMatch(/Progress: 0%/)

      advanceTime(1000)
      expect(tracker.update(250, 0)).toMatch(/Progress: 25%/)

      advanceTime(1000)
      expect(tracker.update(500, 0)).toMatch(/Progress: 50%/)

      advanceTime(1000)
      expect(tracker.update(750, 0)).toMatch(/Progress: 75%/)

      advanceTime(1000)
      expect(tracker.update(1000, 0)).toMatch(/Progress: 100%/)
    })

    test('rounds percentage correctly', () => {
      const tracker = new ProgressTracker(1000)

      // 333/1000 = 33.3% → rounds to 33%
      expect(tracker.update(333, 0)).toMatch(/Progress: 33%/)

      advanceTime(1000)
      // 666/1000 = 66.6% → rounds to 67%
      expect(tracker.update(666, 0)).toMatch(/Progress: 67%/)
    })

    test('tracks devices found', () => {
      const tracker = new ProgressTracker(1000)

      expect(tracker.update(100, 0)).toMatch(/Devices found: 0/)

      advanceTime(1000)
      expect(tracker.update(200, 1)).toMatch(/Devices found: 1/)

      advanceTime(1000)
      expect(tracker.update(300, 5)).toMatch(/Devices found: 5/)
    })

    test('calculates elapsed time correctly', () => {
      const tracker = new ProgressTracker(1000)

      expect(tracker.update(0, 0)).toMatch(/Elapsed: 0s/)

      advanceTime(5000) // 5 seconds
      expect(tracker.update(100, 0)).toMatch(/Elapsed: 5s/)

      advanceTime(55000) // 55 more seconds = 60 total
      expect(tracker.update(200, 0)).toMatch(/Elapsed: 1m 0s/)

      advanceTime(3540000) // 59 more minutes = 1 hour total
      expect(tracker.update(300, 0)).toMatch(/Elapsed: 1h 0m/)
    })

    test('calculates ETA correctly with different rates', () => {
      const tracker = new ProgressTracker(1000)

      // Fast rate: 100 items in 1 second = 100/s
      advanceTime(1000)
      const fast = tracker.update(100, 0)
      // Remaining: 900, Rate: 100/s, ETA: 9s
      expect(fast).toMatch(/ETA: 9s/)

      // Slow rate: 100 items in 100 seconds = 1/s
      const tracker2 = new ProgressTracker(1000)
      advanceTime(100000)
      const slow = tracker2.update(100, 0)
      // Remaining: 900, Rate: 1/s, ETA: 900s = 15m 0s
      expect(slow).toMatch(/ETA: 15m 0s/)
    })
  })

  describe('formatDuration', () => {
    test('formats seconds correctly', () => {
      const tracker = new ProgressTracker(1000)

      expect(tracker.update(0, 0)).toMatch(/Elapsed: 0s/)

      advanceTime(1000)
      expect(tracker.update(100, 0)).toMatch(/Elapsed: 1s/)

      advanceTime(58000) // Total 59s
      expect(tracker.update(200, 0)).toMatch(/Elapsed: 59s/)
    })

    test('formats minutes and seconds correctly', () => {
      const tracker = new ProgressTracker(1000)

      advanceTime(60000) // 1 minute
      expect(tracker.update(100, 0)).toMatch(/Elapsed: 1m 0s/)

      advanceTime(30000) // 1m 30s total
      expect(tracker.update(200, 0)).toMatch(/Elapsed: 1m 30s/)

      advanceTime(1800000) // 31m 30s total (60s + 30s + 1800s = 1890s)
      expect(tracker.update(300, 0)).toMatch(/Elapsed: 31m 30s/)

      advanceTime(1680000) // 59m 30s total (1890s + 1680s = 3570s)
      expect(tracker.update(400, 0)).toMatch(/Elapsed: 59m 30s/)
    })

    test('formats hours and minutes correctly (no seconds)', () => {
      const tracker = new ProgressTracker(1000)

      advanceTime(3600000) // 1 hour
      expect(tracker.update(100, 0)).toMatch(/Elapsed: 1h 0m/)

      advanceTime(1800000) // 1h 30m total
      expect(tracker.update(200, 0)).toMatch(/Elapsed: 1h 30m/)

      advanceTime(36000000) // 11h 30m total
      expect(tracker.update(300, 0)).toMatch(/Elapsed: 11h 30m/)
    })

    test('formats ETA with same logic', () => {
      const tracker = new ProgressTracker(1000)

      // ETA of 45 seconds
      advanceTime(5000)
      const result1 = tracker.update(100, 0)
      // Remaining: 900, Rate: 20/s, ETA: 45s
      expect(result1).toMatch(/ETA: 45s/)

      // ETA of 5 minutes
      const tracker2 = new ProgressTracker(1000)
      advanceTime(20000)
      const result2 = tracker2.update(100, 0)
      // Remaining: 900, Rate: 5/s, ETA: 180s = 3m 0s
      expect(result2).toMatch(/ETA: 3m 0s/)

      // ETA of 1 hour
      const tracker3 = new ProgressTracker(1000)
      advanceTime(360000) // 6 minutes
      const result3 = tracker3.update(100, 0)
      // Remaining: 900, Rate: 0.278/s, ETA: 3240s = 54m 0s
      expect(result3).toMatch(/ETA: 54m 0s/)
    })
  })
})
