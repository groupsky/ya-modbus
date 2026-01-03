import {
  BYTES_PER_REGISTER,
  DEFAULT_BATCH_SIZE,
  MAX_PORT,
  MAX_SLAVE_ID,
  MIN_PORT,
  MIN_SLAVE_ID,
  PROGRESS_UPDATE_INTERVAL_MS,
} from './constants.js'

describe('constants', () => {
  describe('port range', () => {
    it('should have min port less than max port', () => {
      expect(MIN_PORT).toBeLessThan(MAX_PORT)
    })

    it('should have min port greater than 0', () => {
      expect(MIN_PORT).toBeGreaterThan(0)
    })

    it('should have max port at or below maximum 16-bit unsigned integer', () => {
      expect(MAX_PORT).toBeLessThanOrEqual(65535)
    })

    it('should have valid port range for standard services', () => {
      // Ensure range allows standard Modbus TCP port (502)
      expect(MIN_PORT).toBeLessThanOrEqual(502)
      expect(MAX_PORT).toBeGreaterThanOrEqual(502)
    })
  })

  describe('slave ID range', () => {
    it('should have min slave ID less than max slave ID', () => {
      expect(MIN_SLAVE_ID).toBeLessThan(MAX_SLAVE_ID)
    })

    it('should have min slave ID greater than 0', () => {
      expect(MIN_SLAVE_ID).toBeGreaterThan(0)
    })

    it('should have max slave ID within Modbus specification', () => {
      // Modbus specification allows slave IDs 1-247
      expect(MAX_SLAVE_ID).toBeLessThanOrEqual(247)
    })

    it('should exclude broadcast address (0)', () => {
      expect(MIN_SLAVE_ID).toBeGreaterThan(0)
    })
  })

  describe('batch size', () => {
    it('should have positive default batch size', () => {
      expect(DEFAULT_BATCH_SIZE).toBeGreaterThan(0)
    })

    it('should have reasonable batch size for network efficiency', () => {
      // Modbus allows up to 125 registers per read
      expect(DEFAULT_BATCH_SIZE).toBeLessThanOrEqual(125)
    })

    it('should have batch size suitable for quick responses', () => {
      // Small batch sizes reduce latency for first results
      expect(DEFAULT_BATCH_SIZE).toBeLessThan(50)
    })
  })

  describe('register size', () => {
    it('should have exactly 2 bytes per Modbus register', () => {
      expect(BYTES_PER_REGISTER).toBe(2)
    })

    it('should be consistent with 16-bit register specification', () => {
      expect(BYTES_PER_REGISTER * 8).toBe(16)
    })
  })

  describe('progress update interval', () => {
    it('should have positive interval', () => {
      expect(PROGRESS_UPDATE_INTERVAL_MS).toBeGreaterThan(0)
    })

    it('should not update too frequently to avoid console spam', () => {
      // At least 50ms between updates to avoid overwhelming console
      expect(PROGRESS_UPDATE_INTERVAL_MS).toBeGreaterThanOrEqual(50)
    })

    it('should update frequently enough for responsive UI', () => {
      // Not more than 1 second between updates
      expect(PROGRESS_UPDATE_INTERVAL_MS).toBeLessThanOrEqual(1000)
    })
  })

  describe('constant relationships', () => {
    it('should have all positive integer constants', () => {
      const constants = [
        MIN_PORT,
        MAX_PORT,
        MIN_SLAVE_ID,
        MAX_SLAVE_ID,
        DEFAULT_BATCH_SIZE,
        BYTES_PER_REGISTER,
        PROGRESS_UPDATE_INTERVAL_MS,
      ]

      constants.forEach((constant) => {
        expect(Number.isInteger(constant)).toBe(true)
        expect(constant).toBeGreaterThan(0)
      })
    })

    it('should have max values greater than corresponding min values', () => {
      expect(MAX_PORT).toBeGreaterThan(MIN_PORT)
      expect(MAX_SLAVE_ID).toBeGreaterThan(MIN_SLAVE_ID)
    })
  })
})
