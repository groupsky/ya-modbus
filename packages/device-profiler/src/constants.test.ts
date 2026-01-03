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
    it('should have valid min port', () => {
      expect(MIN_PORT).toBe(1)
    })

    it('should have valid max port', () => {
      expect(MAX_PORT).toBe(65535)
    })

    it('should have min less than max', () => {
      expect(MIN_PORT).toBeLessThan(MAX_PORT)
    })
  })

  describe('slave ID range', () => {
    it('should have valid min slave ID', () => {
      expect(MIN_SLAVE_ID).toBe(1)
    })

    it('should have valid max slave ID', () => {
      expect(MAX_SLAVE_ID).toBe(247)
    })

    it('should have min less than max', () => {
      expect(MIN_SLAVE_ID).toBeLessThan(MAX_SLAVE_ID)
    })
  })

  describe('batch size', () => {
    it('should have positive default batch size', () => {
      expect(DEFAULT_BATCH_SIZE).toBeGreaterThan(0)
      expect(DEFAULT_BATCH_SIZE).toBe(10)
    })
  })

  describe('register size', () => {
    it('should have 2 bytes per register', () => {
      expect(BYTES_PER_REGISTER).toBe(2)
    })
  })

  describe('progress update interval', () => {
    it('should have positive interval', () => {
      expect(PROGRESS_UPDATE_INTERVAL_MS).toBeGreaterThan(0)
      expect(PROGRESS_UPDATE_INTERVAL_MS).toBe(100)
    })
  })
})
