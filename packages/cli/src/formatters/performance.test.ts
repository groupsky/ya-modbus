import { formatPerformance } from './performance.js'

describe('Performance Formatter', () => {
  test('should show requests, retries and data points as separate numbers', () => {
    const result = formatPerformance({
      responseTimeMs: 45,
      requests: 2,
      retries: 0,
      dataPoints: 56,
    })

    expect(result).toContain('Performance:')
    expect(result).toContain('Response time: 45.0ms')
    expect(result).toContain('Requests: 2')
    expect(result).toContain('Retries: 0')
    expect(result).toContain('Data points: 56')
  })

  test('should format large response times', () => {
    const result = formatPerformance({
      responseTimeMs: 1234,
      requests: 1,
      retries: 0,
      dataPoints: 1,
    })

    expect(result).toContain('Response time: 1234.0ms')
  })

  test('should format sub-millisecond times', () => {
    const result = formatPerformance({
      responseTimeMs: 0.5,
      requests: 1,
      retries: 0,
      dataPoints: 1,
    })

    expect(result).toContain('0.5ms')
  })

  test('should format performance output correctly (snapshot)', () => {
    const result = formatPerformance({
      responseTimeMs: 45.5,
      requests: 2,
      retries: 1,
      dataPoints: 3,
    })

    expect(result).toMatchInlineSnapshot(`
"
Performance:
  Response time: 45.5ms
  Requests: 2
  Retries: 1
  Data points: 3"
`)
  })
})
