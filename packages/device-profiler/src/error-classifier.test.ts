import { classifyError, ErrorType } from './error-classifier.js'

describe('classifyError', () => {
  describe('timeout errors', () => {
    it('should classify timeout error from message', () => {
      const error = new Error('Timed out')
      expect(classifyError(error)).toBe(ErrorType.Timeout)
    })

    it('should classify timeout error case-insensitively', () => {
      const error = new Error('Request TIMEOUT waiting for response')
      expect(classifyError(error)).toBe(ErrorType.Timeout)
    })

    it('should classify ETIMEDOUT error code', () => {
      const error = Object.assign(new Error('Connection failed'), { code: 'ETIMEDOUT' })
      expect(classifyError(error)).toBe(ErrorType.Timeout)
    })
  })

  describe('CRC errors', () => {
    it('should classify CRC error from message', () => {
      const error = new Error('Bad CRC')
      expect(classifyError(error)).toBe(ErrorType.CRC)
    })

    it('should classify checksum error', () => {
      const error = new Error('Checksum failed')
      expect(classifyError(error)).toBe(ErrorType.CRC)
    })

    it('should classify CRC error case-insensitively', () => {
      const error = new Error('Invalid crc detected')
      expect(classifyError(error)).toBe(ErrorType.CRC)
    })
  })

  describe('Modbus exception errors', () => {
    it('should classify illegal function exception', () => {
      const error = new Error('Modbus exception 1: Illegal function')
      expect(classifyError(error)).toBe(ErrorType.ModbusException)
    })

    it('should classify illegal data address exception', () => {
      const error = new Error('Modbus exception 2: Illegal data address')
      expect(classifyError(error)).toBe(ErrorType.ModbusException)
    })

    it('should classify illegal data value exception', () => {
      const error = new Error('Modbus exception 3: Illegal data value')
      expect(classifyError(error)).toBe(ErrorType.ModbusException)
    })

    it('should classify gateway path unavailable exception', () => {
      const error = new Error('Modbus exception 10: Gateway path unavailable')
      expect(classifyError(error)).toBe(ErrorType.ModbusException)
    })

    it('should classify exception from message pattern', () => {
      const error = new Error('Exception 0x02 returned')
      expect(classifyError(error)).toBe(ErrorType.ModbusException)
    })
  })

  describe('unknown errors', () => {
    it('should classify generic connection error as unknown', () => {
      const error = new Error('Port not open')
      expect(classifyError(error)).toBe(ErrorType.Unknown)
    })

    it('should classify ECONNREFUSED as unknown', () => {
      const error = Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' })
      expect(classifyError(error)).toBe(ErrorType.Unknown)
    })

    it('should classify unexpected error message as unknown', () => {
      const error = new Error('Something went wrong')
      expect(classifyError(error)).toBe(ErrorType.Unknown)
    })
  })

  describe('edge cases', () => {
    it('should handle non-Error objects', () => {
      const error = { message: 'timeout' }
      expect(classifyError(error as Error)).toBe(ErrorType.Timeout)
    })

    it('should handle errors without message', () => {
      const error = new Error()
      expect(classifyError(error)).toBe(ErrorType.Unknown)
    })

    it('should handle null/undefined message', () => {
      const error = { message: null } as unknown as Error
      expect(classifyError(error)).toBe(ErrorType.Unknown)
    })
  })
})
