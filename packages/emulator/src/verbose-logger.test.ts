/**
 * Tests for verbose logging functionality
 */

import { VerboseLogger } from './verbose-logger.js'

describe('VerboseLogger', () => {
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  describe('disabled logger', () => {
    test('does not log read operations when disabled', () => {
      const logger = new VerboseLogger(false)

      logger.logRead(1, 0x03, 0x0000, 2, Buffer.from([0x01, 0x23, 0x45, 0x67]))

      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    test('does not log write operations when disabled', () => {
      const logger = new VerboseLogger(false)

      logger.logWrite(1, 0x06, 0x0005, 1, [0x1234])

      expect(consoleLogSpy).not.toHaveBeenCalled()
    })
  })

  describe('enabled logger', () => {
    test('logs read holding registers operation', () => {
      const logger = new VerboseLogger(true)

      logger.logRead(1, 0x03, 0x0000, 2, Buffer.from([0x01, 0x03, 0x04, 0x01, 0x23, 0x45, 0x67]))

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('[VERBOSE]')
      expect(output).toContain('READ')
      expect(output).toContain('slave=1')
      expect(output).toContain('func=0x03')
      expect(output).toContain('addr=0x0000')
      expect(output).toContain('count=2')
      expect(output).toContain('values=[0x0123, 0x4567]')
    })

    test('logs read input registers operation', () => {
      const logger = new VerboseLogger(true)

      logger.logRead(
        1,
        0x04,
        0x0010,
        3,
        Buffer.from([0x01, 0x04, 0x06, 0xab, 0xcd, 0xef, 0x01, 0x12, 0x34])
      )

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('READ')
      expect(output).toContain('slave=1')
      expect(output).toContain('func=0x04')
      expect(output).toContain('addr=0x0010')
      expect(output).toContain('count=3')
      expect(output).toContain('values=[0xABCD, 0xEF01, 0x1234]')
    })

    test('logs write single register operation', () => {
      const logger = new VerboseLogger(true)

      logger.logWrite(1, 0x06, 0x0005, 1, [0x1234])

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('WRITE')
      expect(output).toContain('slave=1')
      expect(output).toContain('func=0x06')
      expect(output).toContain('addr=0x0005')
      expect(output).toContain('count=1')
      expect(output).toContain('values=[0x1234]')
    })

    test('logs write multiple registers operation', () => {
      const logger = new VerboseLogger(true)

      logger.logWrite(1, 0x10, 0x0100, 4, [0x1111, 0x2222, 0x3333, 0x4444])

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('WRITE')
      expect(output).toContain('slave=1')
      expect(output).toContain('func=0x10')
      expect(output).toContain('addr=0x0100')
      expect(output).toContain('count=4')
      expect(output).toContain('values=[0x1111, 0x2222, 0x3333, 0x4444]')
    })

    test('handles empty values array', () => {
      const logger = new VerboseLogger(true)

      logger.logWrite(1, 0x10, 0x0000, 0, [])

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('values=[]')
    })

    test('formats addresses with padding', () => {
      const logger = new VerboseLogger(true)

      logger.logRead(1, 0x03, 0x0001, 1, Buffer.from([0x01, 0x03, 0x02, 0xff, 0xee]))

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('addr=0x0001')
    })

    test('formats values with padding', () => {
      const logger = new VerboseLogger(true)

      logger.logWrite(1, 0x06, 0x0000, 1, [0x0001])

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('values=[0x0001]')
    })
  })

  describe('parseReadResponse', () => {
    test('parses read holding registers response', () => {
      const logger = new VerboseLogger(true)
      const response = Buffer.from([0x01, 0x03, 0x04, 0x01, 0x23, 0x45, 0x67])

      logger.logRead(1, 0x03, 0x0000, 2, response)

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('values=[0x0123, 0x4567]')
    })

    test('handles short response buffer gracefully', () => {
      const logger = new VerboseLogger(true)
      const response = Buffer.from([0x01, 0x03])

      logger.logRead(1, 0x03, 0x0000, 2, response)

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('values=[]')
    })

    test('handles malformed response with incorrect byte count', () => {
      const logger = new VerboseLogger(true)
      const response = Buffer.from([0x01, 0x03, 0x10, 0x12, 0x34]) // byteCount=16 but only 2 bytes

      logger.logRead(1, 0x03, 0x0000, 1, response)

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('values=[0x1234]')
    })

    test('handles odd number of bytes in response', () => {
      const logger = new VerboseLogger(true)
      const response = Buffer.from([0x01, 0x03, 0x10, 0x12, 0x34, 0x56]) // 3 bytes but last is incomplete

      logger.logRead(1, 0x03, 0x0000, 2, response)

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('values=[0x1234]')
    })

    test('handles response with exact byte count', () => {
      const logger = new VerboseLogger(true)
      const response = Buffer.from([0x01, 0x03, 0x04, 0x12, 0x34, 0x56, 0x78])

      logger.logRead(1, 0x03, 0x0000, 2, response)

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = consoleLogSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('values=[0x1234, 0x5678]')
    })
  })
})
