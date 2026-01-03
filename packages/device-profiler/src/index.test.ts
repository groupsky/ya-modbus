import {
  BYTES_PER_REGISTER,
  classifyError,
  DEFAULT_BATCH_SIZE,
  ErrorType,
  formatProgress,
  formatSummary,
  MAX_PORT,
  MAX_SLAVE_ID,
  MIN_PORT,
  MIN_SLAVE_ID,
  PROGRESS_UPDATE_INTERVAL_MS,
  RegisterType,
  scanRegisters,
  testRead,
} from './index.js'

describe('index exports', () => {
  it('should export classifyError', () => {
    expect(typeof classifyError).toBe('function')
  })

  it('should export ErrorType', () => {
    expect(ErrorType.Timeout).toBe('timeout')
  })

  it('should export testRead', () => {
    expect(typeof testRead).toBe('function')
  })

  it('should export RegisterType', () => {
    expect(RegisterType.Holding).toBe('holding')
  })

  it('should export scanRegisters', () => {
    expect(typeof scanRegisters).toBe('function')
  })

  it('should export formatProgress', () => {
    expect(typeof formatProgress).toBe('function')
  })

  it('should export formatSummary', () => {
    expect(typeof formatSummary).toBe('function')
  })

  it('should export MIN_PORT', () => {
    expect(typeof MIN_PORT).toBe('number')
  })

  it('should export MAX_PORT', () => {
    expect(typeof MAX_PORT).toBe('number')
  })

  it('should export MIN_SLAVE_ID', () => {
    expect(typeof MIN_SLAVE_ID).toBe('number')
  })

  it('should export MAX_SLAVE_ID', () => {
    expect(typeof MAX_SLAVE_ID).toBe('number')
  })

  it('should export DEFAULT_BATCH_SIZE', () => {
    expect(typeof DEFAULT_BATCH_SIZE).toBe('number')
  })

  it('should export BYTES_PER_REGISTER', () => {
    expect(typeof BYTES_PER_REGISTER).toBe('number')
  })

  it('should export PROGRESS_UPDATE_INTERVAL_MS', () => {
    expect(typeof PROGRESS_UPDATE_INTERVAL_MS).toBe('number')
  })
})
