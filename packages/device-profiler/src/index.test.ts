import {
  classifyError,
  ErrorType,
  testRead,
  RegisterType,
  scanRegisters,
  formatProgress,
  formatSummary,
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
})
