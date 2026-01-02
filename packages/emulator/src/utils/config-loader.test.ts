/**
 * Tests for config loader
 */

import { writeFile, unlink, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'

import { loadConfig } from './config-loader.js'

describe('loadConfig', () => {
  let testDir: string
  let testFilePath: string

  beforeEach(async () => {
    testDir = join(tmpdir(), 'emulator-test-' + Date.now())
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    if (testFilePath) {
      try {
        await unlink(testFilePath)
      } catch {
        // Ignore if file doesn't exist
      }
    }
  })

  describe('YAML files', () => {
    it('should load valid YAML config file', async () => {
      testFilePath = join(testDir, 'config.yaml')
      const configContent = `
transport:
  type: rtu
  port: /dev/ttyUSB0
  baudRate: 9600

devices:
  - slaveId: 1
    registers:
      holding:
        0: 230
        1: 52
`
      await writeFile(testFilePath, configContent, 'utf-8')

      const config = await loadConfig(testFilePath)

      expect(config.transport.type).toBe('rtu')
      expect(config.transport.port).toBe('/dev/ttyUSB0')
      expect(config.transport.baudRate).toBe(9600)
      expect(config.devices).toHaveLength(1)
      expect(config.devices[0].slaveId).toBe(1)
      expect(config.devices[0].registers?.holding?.[0]).toBe(230)
    })

    it('should load YAML file with .yml extension', async () => {
      testFilePath = join(testDir, 'config.yml')
      const configContent = `
transport:
  type: memory

devices:
  - slaveId: 1
`
      await writeFile(testFilePath, configContent, 'utf-8')

      const config = await loadConfig(testFilePath)

      expect(config.transport.type).toBe('memory')
      expect(config.devices).toHaveLength(1)
    })

    it('should load YAML with multiple devices', async () => {
      testFilePath = join(testDir, 'config.yaml')
      const configContent = `
transport:
  type: rtu
  port: /dev/ttyUSB0

devices:
  - slaveId: 1
    registers:
      holding:
        0: 100
  - slaveId: 2
    registers:
      holding:
        0: 200
  - slaveId: 3
    registers:
      holding:
        0: 300
`
      await writeFile(testFilePath, configContent, 'utf-8')

      const config = await loadConfig(testFilePath)

      expect(config.devices).toHaveLength(3)
      expect(config.devices[0].slaveId).toBe(1)
      expect(config.devices[1].slaveId).toBe(2)
      expect(config.devices[2].slaveId).toBe(3)
    })

    it('should load YAML with timing configuration', async () => {
      testFilePath = join(testDir, 'config.yaml')
      const configContent = `
transport:
  type: rtu
  port: /dev/ttyUSB0

devices:
  - slaveId: 1
    timing:
      pollingInterval: 10
      processingDelay: 5
      perRegisterDelay: 0.1
`
      await writeFile(testFilePath, configContent, 'utf-8')

      const config = await loadConfig(testFilePath)

      expect(config.devices[0].timing?.pollingInterval).toBe(10)
      expect(config.devices[0].timing?.processingDelay).toBe(5)
      expect(config.devices[0].timing?.perRegisterDelay).toBe(0.1)
    })
  })

  describe('JSON files', () => {
    it('should load valid JSON config file', async () => {
      testFilePath = join(testDir, 'config.json')
      const configContent = {
        transport: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 19200,
        },
        devices: [
          {
            slaveId: 1,
            registers: {
              holding: {
                0: 230,
              },
            },
          },
        ],
      }
      await writeFile(testFilePath, JSON.stringify(configContent, null, 2), 'utf-8')

      const config = await loadConfig(testFilePath)

      expect(config.transport.type).toBe('rtu')
      expect(config.transport.port).toBe('/dev/ttyUSB0')
      expect(config.transport.baudRate).toBe(19200)
      expect(config.devices).toHaveLength(1)
    })

    it('should load JSON with multiple devices', async () => {
      testFilePath = join(testDir, 'config.json')
      const configContent = {
        transport: { type: 'memory' },
        devices: [{ slaveId: 1 }, { slaveId: 2 }],
      }
      await writeFile(testFilePath, JSON.stringify(configContent), 'utf-8')

      const config = await loadConfig(testFilePath)

      expect(config.devices).toHaveLength(2)
      expect(config.devices[0].slaveId).toBe(1)
      expect(config.devices[1].slaveId).toBe(2)
    })
  })

  describe('error handling', () => {
    it('should throw for non-existent file', async () => {
      await expect(loadConfig('/nonexistent/config.yaml')).rejects.toThrow()
    })

    it('should throw for unsupported file format', async () => {
      testFilePath = join(testDir, 'config.txt')
      await writeFile(testFilePath, 'some content', 'utf-8')

      await expect(loadConfig(testFilePath)).rejects.toThrow(
        'Unsupported config format. Use .yaml, .yml, or .json'
      )
    })

    it('should throw for invalid YAML syntax', async () => {
      testFilePath = join(testDir, 'config.yaml')
      await writeFile(testFilePath, 'invalid: yaml: syntax:', 'utf-8')

      await expect(loadConfig(testFilePath)).rejects.toThrow()
    })

    it('should throw for invalid JSON syntax', async () => {
      testFilePath = join(testDir, 'config.json')
      await writeFile(testFilePath, '{ invalid json }', 'utf-8')

      await expect(loadConfig(testFilePath)).rejects.toThrow()
    })

    it('should throw for missing transport config', async () => {
      testFilePath = join(testDir, 'config.yaml')
      const configContent = `
devices:
  - slaveId: 1
`
      await writeFile(testFilePath, configContent, 'utf-8')

      await expect(loadConfig(testFilePath)).rejects.toThrow('Missing transport configuration')
    })

    it('should throw for missing devices config', async () => {
      testFilePath = join(testDir, 'config.yaml')
      const configContent = `
transport:
  type: memory
`
      await writeFile(testFilePath, configContent, 'utf-8')

      await expect(loadConfig(testFilePath)).rejects.toThrow('Missing devices configuration')
    })

    it('should throw for empty devices array', async () => {
      testFilePath = join(testDir, 'config.yaml')
      const configContent = `
transport:
  type: memory
devices: []
`
      await writeFile(testFilePath, configContent, 'utf-8')

      await expect(loadConfig(testFilePath)).rejects.toThrow(
        'At least one device must be configured'
      )
    })

    it('should throw for non-object config (string)', async () => {
      testFilePath = join(testDir, 'config.yaml')
      await writeFile(testFilePath, '"just a string"', 'utf-8')

      await expect(loadConfig(testFilePath)).rejects.toThrow('Invalid configuration format')
    })

    it('should throw for non-object transport (null)', async () => {
      testFilePath = join(testDir, 'config.yaml')
      const configContent = `
transport: null
devices:
  - slaveId: 1
`
      await writeFile(testFilePath, configContent, 'utf-8')

      await expect(loadConfig(testFilePath)).rejects.toThrow('Missing transport configuration')
    })

    it('should throw for non-object transport (string)', async () => {
      testFilePath = join(testDir, 'config.yaml')
      const configContent = `
transport: "memory"
devices:
  - slaveId: 1
`
      await writeFile(testFilePath, configContent, 'utf-8')

      await expect(loadConfig(testFilePath)).rejects.toThrow('Invalid transport configuration')
    })

    it('should throw for non-array devices', async () => {
      testFilePath = join(testDir, 'config.yaml')
      const configContent = `
transport:
  type: memory
devices: "not an array"
`
      await writeFile(testFilePath, configContent, 'utf-8')

      await expect(loadConfig(testFilePath)).rejects.toThrow('Devices must be an array')
    })
  })
})
