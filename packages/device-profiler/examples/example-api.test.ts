/**
 * Jest test for example-api.ts
 *
 * Tests the API example by:
 * 1. Creating a mock transport
 * 2. Running the scanDevice function
 * 3. Verifying it completes without error
 */

import type { Transport } from '@ya-modbus/driver-types'

import { scanDevice } from './example-api.js'

describe('example-api', () => {
  it('scans registers using scanRegisters API', async () => {
    const mockTransport: Transport = {
      readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x01, 0x00, 0x02])),
    } as unknown as Transport

    // Capture console output
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    await scanDevice(mockTransport)

    // Verify scanRegisters was called
    expect(mockTransport.readHoldingRegisters).toHaveBeenCalled()

    // Verify progress and result callbacks produced output
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
