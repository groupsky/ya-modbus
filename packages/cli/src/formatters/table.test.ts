import type { DataPoint } from '@ya-modbus/driver-types'

import { formatTable } from './table.js'

describe('Table Formatter', () => {
  test('should format single data point as table', () => {
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

    const result = formatTable(dataPoints, values)

    expect(result).toContain('Data Point')
    expect(result).toContain('Value')
    expect(result).toContain('Unit')
    expect(result).toContain('Temperature') // Uses name, not id
    expect(result).toContain('24.5')
    expect(result).toContain('°C')
  })

  test('should format multiple data points', () => {
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

    const result = formatTable(dataPoints, values)

    expect(result).toContain('Temperature') // Uses name, not id
    expect(result).toContain('Humidity') // Uses name, not id
    expect(result).toContain('24.5')
    expect(result).toContain('65.2')
  })

  test('should format numbers with correct decimals', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'voltage',
        type: 'float',
        unit: 'V',
        decimals: 2,
        access: 'r',
      },
    ]

    const values = { voltage: 230.456789 }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('230.46') // Rounded to 2 decimals
  })

  test('should format integers without decimals', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'count',
        type: 'integer',
        access: 'r',
      },
    ]

    const values = { count: 42 }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('42')
    expect(result).not.toContain('42.0')
  })

  test('should format booleans as true/false', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'enabled',
        type: 'boolean',
        access: 'rw',
      },
    ]

    const values = { enabled: true }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('true')
  })

  test('should format false boolean value', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'disabled',
        type: 'boolean',
        access: 'rw',
      },
    ]

    const values = { disabled: false }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('false')
  })

  test('should format enum values', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'mode',
        type: 'enum',
        access: 'rw',
        enumValues: {
          0: 'Off',
          1: 'Auto',
          2: 'Manual',
        },
      },
    ]

    const values = { mode: 1 }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('Auto')
  })

  test('should handle missing unit gracefully', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'status',
        type: 'integer',
        access: 'r',
      },
    ]

    const values = { status: 1 }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('status')
    expect(result).toContain('1')
  })

  test('should skip data points not in values', () => {
    const dataPoints: DataPoint[] = [
      { id: 'temp1', type: 'float', access: 'r' },
      { id: 'temp2', type: 'float', access: 'r' },
      { id: 'temp3', type: 'float', access: 'r' },
    ]

    const values = {
      temp1: 20.0,
      temp3: 25.0,
    }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('temp1')
    expect(result).toContain('temp3')
    expect(result).not.toContain('temp2')
  })

  test('should use name if provided instead of id', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'voltage_l1',
        name: 'Line 1 Voltage',
        type: 'float',
        unit: 'V',
        access: 'r',
      },
    ]

    const values = { voltage_l1: 230.0 }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('Line 1 Voltage')
  })

  test('should format timestamp type', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'last_update',
        type: 'timestamp',
        access: 'r',
      },
    ]

    const values = { last_update: new Date('2025-12-23T12:00:00Z') }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('2025-12-23')
  })

  test('should format null values as N/A', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'temperature',
        type: 'float',
        access: 'r',
      },
    ]

    const values = { temperature: null }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('N/A')
  })

  test('should format undefined values as N/A', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'humidity',
        type: 'float',
        access: 'r',
      },
    ]

    const values = { humidity: undefined }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('N/A')
  })

  test('should format enum without enumValues', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'status',
        type: 'enum',
        access: 'r',
      },
    ]

    const values = { status: 2 }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('2')
  })

  test('should format timestamp with non-Date value', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'timestamp',
        type: 'timestamp',
        access: 'r',
      },
    ]

    const values = { timestamp: 1234567890 }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('1234567890')
  })

  test('should format string type', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'device_name',
        type: 'string',
        access: 'r',
      },
    ]

    const values = { device_name: 'Test Device' }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('Test Device')
  })

  test('should format Date values', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'created_at',
        type: 'timestamp',
        access: 'r',
      },
    ]

    const date = new Date('2025-01-15T10:30:00Z')
    const values = { created_at: date }

    const result = formatTable(dataPoints, values)

    expect(result).toContain(date.toISOString())
  })

  test('should format objects as JSON', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'config',
        type: 'string' as any,
        access: 'r',
      },
    ]

    const values = { config: { enabled: true, timeout: 5000 } }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('enabled')
    expect(result).toContain('true')
  })

  test('should format arrays as JSON', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'readings',
        type: 'string' as any,
        access: 'r',
      },
    ]

    const values = { readings: [1, 2, 3, 4, 5] }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('[1,2,3,4,5]')
  })

  test('should handle unknown enum value gracefully', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'mode',
        type: 'enum',
        access: 'r',
        enumValues: {
          0: 'Off',
          1: 'On',
        },
      },
    ]

    const values = { mode: 99 }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('99')
  })

  test('should format unknown data type using default case', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'custom',
        type: 'custom-type' as any,
        access: 'r',
      },
    ]

    const values = { custom: 'custom-value' }

    const result = formatTable(dataPoints, values)

    expect(result).toContain('custom-value')
  })

  test('should stringify Date in stringifyValue', () => {
    const dataPoints: DataPoint[] = [
      {
        id: 'date_field',
        type: 'string' as any,
        access: 'r',
      },
    ]

    const date = new Date('2025-12-24T12:00:00Z')
    const values = { date_field: date }

    const result = formatTable(dataPoints, values)

    expect(result).toContain(date.toISOString())
  })

  test('should format table output correctly (snapshot)', () => {
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
      {
        id: 'enabled',
        name: 'Enabled',
        type: 'boolean',
        access: 'r',
      },
    ]

    const values = {
      temperature: 24.5,
      humidity: 65.2,
      enabled: true,
    }

    const result = formatTable(dataPoints, values)

    expect(result).toMatchInlineSnapshot(`
      "Data Point | Value | Unit
      Temperature | 24.5 | °C
      Humidity | 65.2 | %
      Enabled | true | "
    `)
  })
})
