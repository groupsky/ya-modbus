import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'

import { processUtils } from './process.js'

describe('processUtils', () => {
  let processExitSpy: jest.SpyInstance
  let processOnSpy: jest.SpyInstance

  beforeEach(() => {
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      // Don't actually exit
    }) as any)
    processOnSpy = jest.spyOn(process, 'on').mockImplementation(() => process)
  })

  afterEach(() => {
    processExitSpy.mockRestore()
    processOnSpy.mockRestore()
  })

  describe('exit', () => {
    it('should call process.exit with the provided code', () => {
      processUtils.exit(0)
      expect(processExitSpy).toHaveBeenCalledWith(0)
    })

    it('should call process.exit with error code', () => {
      processUtils.exit(1)
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('onSignal', () => {
    it('should register signal handler for SIGINT', () => {
      const handler = jest.fn()
      processUtils.onSignal('SIGINT', handler)
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', handler)
    })

    it('should register signal handler for SIGTERM', () => {
      const handler = jest.fn()
      processUtils.onSignal('SIGTERM', handler)
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', handler)
    })
  })
})
