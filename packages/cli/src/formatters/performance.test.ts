import { formatPerformance } from './performance.js'

describe('Performance Formatter', () => {
  test('should format performance metrics', () => {
    const metrics = {
      responseTimeMs: 45,
      operations: 1,
      errors: 0,
    }

    const result = formatPerformance(metrics)

    expect(result).toContain('Performance:')
    expect(result).toContain('Response time: 45ms')
    expect(result).toContain('Operations: 1')
    expect(result).toContain('Errors: 0')
  })

  test('should highlight errors when present', () => {
    const metrics = {
      responseTimeMs: 120,
      operations: 5,
      errors: 2,
    }

    const result = formatPerformance(metrics)

    expect(result).toContain('Errors: 2')
  })

  test('should format large response times', () => {
    const metrics = {
      responseTimeMs: 1234,
      operations: 10,
      errors: 0,
    }

    const result = formatPerformance(metrics)

    expect(result).toContain('Response time: 1234ms')
  })

  test('should format sub-millisecond times', () => {
    const metrics = {
      responseTimeMs: 0.5,
      operations: 1,
      errors: 0,
    }

    const result = formatPerformance(metrics)

    expect(result).toContain('0.5ms')
  })

  test('should handle multiple operations', () => {
    const metrics = {
      responseTimeMs: 250,
      operations: 15,
      errors: 0,
    }

    const result = formatPerformance(metrics)

    expect(result).toContain('Operations: 15')
  })

  test('should format performance output correctly (snapshot)', () => {
    const metrics = {
      responseTimeMs: 45.5,
      operations: 3,
      errors: 0,
    }

    const result = formatPerformance(metrics)

    expect(result).toMatchInlineSnapshot(`
"
Performance:
  Response time: 45.5ms
  Operations: 3
  Errors: 0"
`)
  })

  test('should format performance with errors (snapshot)', () => {
    const metrics = {
      responseTimeMs: 120,
      operations: 5,
      errors: 2,
    }

    const result = formatPerformance(metrics)

    expect(result).toMatchInlineSnapshot(`
"
Performance:
  Response time: 120ms
  Operations: 5
  Errors: 2"
`)
  })
})
