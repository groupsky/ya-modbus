import type { DataPoint } from '@ya-modbus/driver-types'

import { formatJSON } from './json.js'

describe('JSON Formatter', () => {
  test('should format single data point result', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'temperature',
        name: 'Temperature',
        type: 'float',
        unit: '°C',
        decimals: 1,
        access: 'r',
      },
    ]

    const values = { temperature: 24.5 }
    const metadata = {
      driver: 'ya-modbus-driver-xymd1',
      connection: { port: '/dev/ttyUSB0', slaveId: 1 },
    }

    const result = formatJSON(dataPoints, values, metadata)

    expect(result).toContain('"temperature"')
    expect(result).toContain('24.5')
    expect(result).toContain('°C')
    expect(result).toContain('ya-modbus-driver-xymd1')

    // Should be valid JSON
    expect(() => JSON.parse(result)).not.toThrow()
  })

  test('should format multiple data points', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'temperature',
        type: 'float',
        unit: '°C',
        decimals: 1,
        access: 'r',
      },
      {
        id: 'humidity',
        type: 'float',
        unit: '%',
        decimals: 1,
        access: 'r',
      },
    ]

    const values = {
      temperature: 24.5,
      humidity: 65.2,
    }

    const result = formatJSON(dataPoints, values, {})
    const parsed = JSON.parse(result)

    expect(parsed.dataPoints).toHaveLength(2)
    expect(parsed.dataPoints[0].value).toBe(24.5)
    expect(parsed.dataPoints[1].value).toBe(65.2)
  })

  test('should include timestamp', () => {
    const dataPoints: DataPoint[] = [{ id: 'test', type: 'integer', access: 'r' }]

    const values = { test: 100 }
    const result = formatJSON(dataPoints, values, {})
    const parsed = JSON.parse(result)

    expect(parsed.timestamp).toBeDefined()
    expect(new Date(parsed.timestamp).getTime()).toBeGreaterThan(0)
  })

  test('should include performance metrics if provided', () => {
    const dataPoints: DataPoint[] = [{ id: 'test', type: 'integer', access: 'r' }]

    const values = { test: 100 }
    const performance = {
      responseTimeMs: 45,
      operations: 1,
      errors: 0,
    }

    const result = formatJSON(dataPoints, values, { performance })
    const parsed = JSON.parse(result)

    expect(parsed.performance).toEqual(performance)
  })

  test('should handle missing data points gracefully', () => {
    const dataPoints: DataPoint[] = [
      { id: 'temperature', type: 'float', access: 'r' },
      { id: 'humidity', type: 'float', access: 'r' },
    ]

    const values = { temperature: 24.5 } // humidity missing

    const result = formatJSON(dataPoints, values, {})
    const parsed = JSON.parse(result)

    expect(parsed.dataPoints).toHaveLength(1)
    expect(parsed.dataPoints[0].id).toBe('temperature')
  })

  test('should use pretty printing with 2-space indentation', () => {
    const dataPoints: DataPoint[] = [{ id: 'test', type: 'integer', access: 'r' }]

    const values = { test: 100 }
    const result = formatJSON(dataPoints, values, {})

    // Check for 2-space indentation at first level
    expect(result).toContain('\n  "timestamp"')
    // Nested objects will have 4 spaces (2 per level)
    expect(result).toContain('\n    ')
  })

  test('should format JSON output correctly (snapshot)', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'temperature',
        name: 'Temperature',
        type: 'float',
        unit: '°C',
        decimals: 1,
        access: 'r',
      },
      {
        id: 'humidity',
        name: 'Humidity',
        type: 'float',
        unit: '%',
        decimals: 1,
        access: 'r',
      },
    ]

    const values = {
      temperature: 24.5,
      humidity: 65.2,
    }

    const metadata = {
      driver: 'ya-modbus-driver-xymd1',
      connection: { port: '/dev/ttyUSB0', slaveId: 1 },
      performance: {
        responseTimeMs: 45,
        operations: 2,
        errors: 0,
      },
    }

    const result = formatJSON(dataPoints, values, metadata)
    const parsed = JSON.parse(result)

    // Remove timestamp for stable snapshot
    delete parsed.timestamp

    expect(parsed).toMatchInlineSnapshot(`
      {
        "connection": {
          "port": "/dev/ttyUSB0",
          "slaveId": 1,
        },
        "dataPoints": [
          {
            "access": "r",
            "id": "temperature",
            "name": "Temperature",
            "type": "float",
            "unit": "°C",
            "value": 24.5,
          },
          {
            "access": "r",
            "id": "humidity",
            "name": "Humidity",
            "type": "float",
            "unit": "%",
            "value": 65.2,
          },
        ],
        "driver": "ya-modbus-driver-xymd1",
        "performance": {
          "errors": 0,
          "operations": 2,
          "responseTimeMs": 45,
        },
      }
    `)
  })
})
