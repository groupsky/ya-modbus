import { describe, it, expect } from '@jest/globals'

import { DeviceStats } from './device-stats.js'

describe('DeviceStats', () => {
  it('should report zero counts for a device without polls', () => {
    const stats = new DeviceStats()
    stats.add('a', 0)

    expect(stats.report(10_000).get('a')).toEqual({
      polls: 0,
      errors: 0,
      consecutiveFailures: 0,
      lastSuccess: null,
      avgReadMs: null,
      readsPerSecond: 0,
    })
  })

  it('should count polls, errors and consecutive failures', () => {
    const stats = new DeviceStats()
    stats.add('a', 0)
    stats.record('a', 10, true, 1000)
    stats.record('a', 10, false, 2000)
    stats.record('a', 10, false, 3000)

    expect(stats.report(4000).get('a')).toMatchObject({
      polls: 3,
      errors: 2,
      consecutiveFailures: 2,
      lastSuccess: 1000,
    })
  })

  it('should reset consecutive failures after a successful poll', () => {
    const stats = new DeviceStats()
    stats.add('a', 0)
    stats.record('a', 10, false, 1000)
    stats.record('a', 10, true, 2000)

    expect(stats.report(3000).get('a')).toMatchObject({
      errors: 1,
      consecutiveFailures: 0,
      lastSuccess: 2000,
    })
  })

  it('should average the successful reads and count them per second over the window', () => {
    const stats = new DeviceStats()
    stats.add('a', 0)
    stats.record('a', 100, true, 1000)
    stats.record('a', 300, true, 2000)
    stats.record('a', 5000, false, 3000)

    expect(stats.report(10_000).get('a')).toMatchObject({ avgReadMs: 200, readsPerSecond: 0.2 })
  })

  it('should start a new window after a report, but keep the totals', () => {
    const stats = new DeviceStats()
    stats.add('a', 0)
    stats.record('a', 100, true, 1000)
    stats.report(10_000)
    stats.record('a', 50, true, 11_000)

    expect(stats.report(15_000).get('a')).toMatchObject({
      polls: 2,
      avgReadMs: 50,
      readsPerSecond: 0.2,
    })
    expect(stats.report(20_000).get('a')).toMatchObject({
      polls: 2,
      avgReadMs: null,
      readsPerSecond: 0,
    })
  })

  it('should drop a removed device and ignore its late polls', () => {
    const stats = new DeviceStats()
    stats.add('a', 0)
    stats.remove('a')
    stats.record('a', 10, true, 1000)

    expect(stats.report(2000).size).toBe(0)
  })
})
