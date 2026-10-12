import type ModbusRTU from 'modbus-serial'

import { configureClient, DEFAULT_TIMEOUT_MS } from './client-config.js'

test.each([
  { timeout: 2500, expected: 2500 },
  { timeout: undefined, expected: DEFAULT_TIMEOUT_MS },
])('sets slave ID 7 and timeout $expected when timeout is $timeout', ({ timeout, expected }) => {
  const client = { setID: jest.fn(), setTimeout: jest.fn() }

  configureClient(client as unknown as ModbusRTU, 7, timeout)

  expect(client.setID).toHaveBeenCalledWith(7)
  expect(client.setTimeout).toHaveBeenCalledWith(expected)
})
