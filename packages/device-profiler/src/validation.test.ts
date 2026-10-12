import { InvalidArgumentError } from 'commander'

import { parseInteger, validateOptions, type ProfileOptions } from './validation.js'

const validOptions: ProfileOptions = {
  slaveId: 1,
  start: 0,
  end: 100,
  batch: 10,
  baud: 9600,
  timeout: 1000,
}

describe('parseInteger', () => {
  it.each([
    ['0', 0],
    ['42', 42],
    ['-7', -7],
    ['65535', 65535],
  ])('should parse "%s" as %d', (input, expected) => {
    expect(parseInteger(input)).toBe(expected)
  })

  it.each(['abc', '', '12abc', '1.5', '0x10', '1e3', ' 5', '5 ', '+5'])(
    'should reject "%s"',
    (input) => {
      expect(() => parseInteger(input)).toThrow(InvalidArgumentError)
      expect(() => parseInteger(input)).toThrow('Expected a whole number')
    }
  )
})

describe('validateOptions', () => {
  it('should accept the default option values', () => {
    expect(() => validateOptions(validOptions)).not.toThrow()
  })

  it.each([
    { name: 'lowest slave ID', override: { slaveId: 1 } },
    { name: 'highest slave ID', override: { slaveId: 247 } },
    { name: 'single register range at address 0', override: { start: 0, end: 0 } },
    { name: 'single register range at address 65535', override: { start: 65535, end: 65535 } },
    { name: 'full register range', override: { start: 0, end: 65535 } },
    { name: 'smallest batch size', override: { batch: 1 } },
    { name: 'largest batch size', override: { batch: 125 } },
    { name: 'smallest timeout', override: { timeout: 1 } },
    { name: 'largest timeout', override: { timeout: 2147483647 } },
    { name: 'smallest baud rate', override: { baud: 1 } },
  ])('should accept $name', ({ override }) => {
    expect(() => validateOptions({ ...validOptions, ...override })).not.toThrow()
  })

  it.each([
    {
      name: 'slave ID 0 (broadcast)',
      override: { slaveId: 0 },
      message: 'Invalid slave ID: 0. Must be between 1 and 247 (Modbus specification)',
    },
    {
      name: 'slave ID above 247',
      override: { slaveId: 248 },
      message: 'Invalid slave ID: 248. Must be between 1 and 247 (Modbus specification)',
    },
    {
      name: 'slave ID 999',
      override: { slaveId: 999 },
      message: 'Invalid slave ID: 999. Must be between 1 and 247 (Modbus specification)',
    },
    {
      name: 'negative slave ID',
      override: { slaveId: -1 },
      message: 'Invalid slave ID: -1. Must be between 1 and 247 (Modbus specification)',
    },
    {
      name: 'negative start address',
      override: { start: -1 },
      message: 'Invalid start address: -1. Must be between 0 and 65535',
    },
    {
      name: 'start address above 65535',
      override: { start: 65536, end: 65536 },
      message: 'Invalid start address: 65536. Must be between 0 and 65535',
    },
    {
      name: 'negative end address',
      override: { end: -1 },
      message: 'Invalid end address: -1. Must be between 0 and 65535',
    },
    {
      name: 'end address above 65535',
      override: { end: 65536 },
      message: 'Invalid end address: 65536. Must be between 0 and 65535',
    },
    {
      name: 'start address greater than end address',
      override: { start: 100, end: 50 },
      message: 'Invalid address range: start (100) is greater than end (50)',
    },
    {
      // Regression: with a batch size of 0 the scan loop never advanced and ran forever
      name: 'batch size 0',
      override: { batch: 0 },
      message: 'Invalid batch size: 0. Must be between 1 and 125 (Modbus limit for one read)',
    },
    {
      name: 'negative batch size',
      override: { batch: -1 },
      message: 'Invalid batch size: -1. Must be between 1 and 125 (Modbus limit for one read)',
    },
    {
      name: 'batch size above the Modbus limit',
      override: { batch: 126 },
      message: 'Invalid batch size: 126. Must be between 1 and 125 (Modbus limit for one read)',
    },
    {
      name: 'timeout 0',
      override: { timeout: 0 },
      message: 'Invalid timeout: 0. Must be between 1 and 2147483647 milliseconds',
    },
    {
      name: 'negative timeout',
      override: { timeout: -100 },
      message: 'Invalid timeout: -100. Must be between 1 and 2147483647 milliseconds',
    },
    {
      // Node setTimeout treats larger delays as 1 ms, so every read would time out at once
      name: 'timeout above the setTimeout limit',
      override: { timeout: 2147483648 },
      message: 'Invalid timeout: 2147483648. Must be between 1 and 2147483647 milliseconds',
    },
    {
      name: 'baud rate 0',
      override: { baud: 0 },
      message: 'Invalid baud rate: 0. Must be greater than 0',
    },
    {
      name: 'negative baud rate',
      override: { baud: -9600 },
      message: 'Invalid baud rate: -9600. Must be greater than 0',
    },
  ])('should reject $name', ({ override, message }) => {
    expect(() => validateOptions({ ...validOptions, ...override })).toThrow(message)
  })
})
