import type { LoadedDriver } from './loader.js'
import { createMockDriver, mockSystemDeps } from './testing.js'

describe('Test Utilities', () => {
  describe('createMockDriver', () => {
    test('should create mock driver with default config', () => {
      const mockDriver = createMockDriver({
        defaultConfig: { baudRate: 9600 },
      })

      expect(typeof mockDriver.createDriver).toBe('function')
      expect(mockDriver.defaultConfig).toEqual({ baudRate: 9600 })
    })

    test('should create mock driver with devices', () => {
      const mockDriver = createMockDriver({
        devices: {
          'test-device': {
            manufacturer: 'Test Manufacturer',
            model: 'Test Model',
          },
        },
      })

      expect(mockDriver.devices).toEqual({
        'test-device': {
          manufacturer: 'Test Manufacturer',
          model: 'Test Model',
        },
      })
    })

    test('should create mock driver with supported config', () => {
      const mockDriver = createMockDriver({
        supportedConfig: {
          validBaudRates: [9600, 19200],
        },
      })

      expect(mockDriver.supportedConfig).toEqual({
        validBaudRates: [9600, 19200],
      })
    })

    test('should create mock driver with all properties', () => {
      const mockDriver = createMockDriver({
        defaultConfig: { baudRate: 9600 },
        supportedConfig: { validBaudRates: [9600] },
        devices: { test: { manufacturer: 'Test', model: 'Model' } },
      })

      expect(typeof mockDriver.createDriver).toBe('function')
      expect(mockDriver.defaultConfig).toBeDefined()
      expect(mockDriver.supportedConfig).toBeDefined()
      expect(mockDriver.devices).toBeDefined()
    })

    test('should allow custom createDriver implementation', () => {
      const customCreateDriver = jest.fn().mockReturnValue({ type: 'custom' })
      const mockDriver = createMockDriver({
        createDriver: customCreateDriver,
      })

      const result = mockDriver.createDriver({})
      expect(result).toEqual({ type: 'custom' })
      expect(customCreateDriver).toHaveBeenCalledWith({})
    })
  })

  describe('mockSystemDeps', () => {
    test('should create mock system dependencies with defaults', () => {
      const deps = mockSystemDeps()

      expect(typeof deps.readFile).toBe('function')
      expect(typeof deps.importModule).toBe('function')
      expect(typeof deps.getCwd).toBe('function')
    })

    test('should allow overriding readFile', async () => {
      const customReadFile = jest.fn().mockResolvedValue('custom content')
      const deps = mockSystemDeps({ readFile: customReadFile })

      const result = await deps.readFile('/test/path', 'utf-8')
      expect(result).toBe('custom content')
      expect(customReadFile).toHaveBeenCalledWith('/test/path', 'utf-8')
    })

    test('should allow overriding importModule', async () => {
      const mockDriver: LoadedDriver = {
        createDriver: jest.fn(),
      }
      const customImport = jest.fn().mockResolvedValue(mockDriver)
      const deps = mockSystemDeps({ importModule: customImport })

      const result = await deps.importModule('test-package')
      expect(result).toBe(mockDriver)
      expect(customImport).toHaveBeenCalledWith('test-package')
    })

    test('should allow overriding getCwd', () => {
      const customGetCwd = jest.fn().mockReturnValue('/custom/path')
      const deps = mockSystemDeps({ getCwd: customGetCwd })

      const result = deps.getCwd()
      expect(result).toBe('/custom/path')
    })

    test('should have default getCwd returning /mock/cwd', () => {
      const deps = mockSystemDeps()
      expect(deps.getCwd()).toBe('/mock/cwd')
    })
  })
})
