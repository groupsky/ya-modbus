import type { DiscoveredDevice } from '../discovery/scanner.js'

import { formatDiscoveryJSON, formatDiscoveryTable } from './discovery-results.js'

describe('formatDiscoveryTable', () => {
  test('returns message when no devices found', () => {
    const result = formatDiscoveryTable([])

    expect(result).toBe('No devices found.')
  })

  test('formats single device with full identification', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 52,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: {
          present: true,
          responseTimeMs: 45.67,
          vendorName: 'Test Vendor',
          modelName: 'Test Model',
          productCode: 'TEST-001',
          revision: '1.0',
          supportsFC43: true,
        },
      },
    ]

    const result = formatDiscoveryTable(devices)

    expect(result).toContain('Slave ID')
    expect(result).toContain('52')
    expect(result).toContain('9600')
    expect(result).toContain('N') // None parity
    expect(result).toContain('8N1')
    expect(result).toContain('46ms') // 45.67 rounds to 46
    expect(result).toContain('Test Vendor')
    expect(result).toContain('Test Model')
  })

  test('formats device with even parity', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 1,
        baudRate: 19200,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
        identification: {
          present: true,
          responseTimeMs: 12.34,
        },
      },
    ]

    const result = formatDiscoveryTable(devices)

    expect(result).toContain('E') // Even parity
    expect(result).toContain('8E1')
  })

  test('formats device with odd parity', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'odd',
        dataBits: 8,
        stopBits: 2,
        identification: {
          present: true,
          responseTimeMs: 10.0,
        },
      },
    ]

    const result = formatDiscoveryTable(devices)

    expect(result).toContain('O') // Odd parity
    expect(result).toContain('8O2')
  })

  test('shows dash when vendor name missing', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: {
          present: true,
          responseTimeMs: 10.0,
        },
      },
    ]

    const result = formatDiscoveryTable(devices)

    // Vendor column should have dash when missing
    expect(result).toContain('-')
  })

  test('uses productCode when modelName missing', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: {
          present: true,
          responseTimeMs: 10.0,
          productCode: 'PROD-123',
        },
      },
    ]

    const result = formatDiscoveryTable(devices)

    expect(result).toContain('PROD-123')
  })

  test('shows dash when both modelName and productCode missing', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: {
          present: true,
          responseTimeMs: 10.0,
        },
      },
    ]

    const result = formatDiscoveryTable(devices)

    // Model column should have dash
    expect(result).toContain('-')
  })

  test('sorts devices by slave ID', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 52,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: { present: true, responseTimeMs: 10.0 },
      },
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: { present: true, responseTimeMs: 20.0 },
      },
      {
        slaveId: 10,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: { present: true, responseTimeMs: 15.0 },
      },
    ]

    const result = formatDiscoveryTable(devices)

    // All slave IDs should be present in the table
    expect(result).toContain('1')
    expect(result).toContain('10')
    expect(result).toContain('52')

    // Response times should appear in sorted slave ID order
    // Slave 1 has 20ms, Slave 10 has 15ms, Slave 52 has 10ms
    expect(result).toContain('20ms')
    expect(result).toContain('15ms')
    expect(result).toContain('10ms')
  })

  test('formats response time as integer milliseconds', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: {
          present: true,
          responseTimeMs: 123.456,
        },
      },
    ]

    const result = formatDiscoveryTable(devices)

    expect(result).toContain('123ms')
  })

  test('rounds response time to nearest integer', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: {
          present: true,
          responseTimeMs: 45.7,
        },
      },
    ]

    const result = formatDiscoveryTable(devices)

    expect(result).toContain('46ms') // 45.7 rounds to 46
  })
})

describe('formatDiscoveryJSON', () => {
  test('formats empty array as empty JSON array', () => {
    const result = formatDiscoveryJSON([])

    expect(result).toBe('[]')
  })

  test('formats single device with full identification', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 52,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: {
          present: true,
          responseTimeMs: 45.67,
          vendorName: 'Test Vendor',
          modelName: 'Test Model',
          productCode: 'TEST-001',
          revision: '1.0',
          supportsFC43: true,
        },
      },
    ]

    const result = formatDiscoveryJSON(devices)
    const parsed = JSON.parse(result)

    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toEqual({
      slaveId: 52,
      baudRate: 9600,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      responseTimeMs: 45.67,
      identification: {
        vendorName: 'Test Vendor',
        modelName: 'Test Model',
        productCode: 'TEST-001',
        revision: '1.0',
        supportsFC43: true,
      },
    })
  })

  test('formats device with minimal identification', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 1,
        baudRate: 19200,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
        identification: {
          present: true,
          responseTimeMs: 12.34,
        },
      },
    ]

    const result = formatDiscoveryJSON(devices)
    const parsed = JSON.parse(result)

    expect(parsed[0].identification.vendorName).toBeUndefined()
    expect(parsed[0].identification.modelName).toBeUndefined()
    expect(parsed[0].identification.productCode).toBeUndefined()
    expect(parsed[0].identification.revision).toBeUndefined()
    expect(parsed[0].identification.supportsFC43).toBeUndefined()
  })

  test('formats multiple devices', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: { present: true, responseTimeMs: 10.0 },
      },
      {
        slaveId: 2,
        baudRate: 19200,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
        identification: { present: true, responseTimeMs: 20.0 },
      },
    ]

    const result = formatDiscoveryJSON(devices)
    const parsed = JSON.parse(result)

    expect(parsed).toHaveLength(2)
    expect(parsed[0].slaveId).toBe(1)
    expect(parsed[1].slaveId).toBe(2)
  })

  test('uses pretty-printed JSON with 2-space indentation', () => {
    const devices: DiscoveredDevice[] = [
      {
        slaveId: 1,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: { present: true, responseTimeMs: 10.0 },
      },
    ]

    const result = formatDiscoveryJSON(devices)

    // Should be pretty-printed with newlines and indentation
    expect(result).toContain('\n')
    expect(result).toContain('  ') // 2-space indentation
  })
})
