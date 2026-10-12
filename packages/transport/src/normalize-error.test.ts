import { normalizeModbusError } from './normalize-error.js'

// modbus-serial rejects with plain objects that do not extend Error
// (see node_modules/modbus-serial/index.js: PortNotOpenError, BadAddressError,
// TransactionTimedOutError). The shapes below match what the library produces.
const timedOut = {
  name: 'TransactionTimedOutError',
  message: 'Timed out',
  errno: 'ETIMEDOUT',
}
const portNotOpen = {
  name: 'PortNotOpenError',
  message: 'Port Not Open',
  errno: 'ECONNREFUSED',
}
const badAddress = {
  name: 'BadAddressError',
  message: 'Bad Client Address',
  errno: 'ECONNREFUSED',
}
// SerialPortError, which the client emits as an 'error' event, copies the message
// of the underlying serial port error, which can be missing
const serialPortErrorWithoutMessage = {
  name: 'SerialPortError',
  message: undefined,
  errno: 'ECONNREFUSED',
}

test.each([
  { label: 'TransactionTimedOutError', original: timedOut },
  { label: 'PortNotOpenError', original: portNotOpen },
  { label: 'BadAddressError', original: badAddress },
])('converts $label to an Error that keeps message, name and errno', ({ original }) => {
  const result = normalizeModbusError(original)

  expect(result).toBeInstanceOf(Error)
  expect(result.message).toBe(original.message)
  expect(result.name).toBe(original.name)
  expect(result.errno).toBe(original.errno)
  expect(result.cause).toBe(original)
})

test('never produces "[object Object]" as message', () => {
  const result = normalizeModbusError(timedOut)

  expect(String(result)).toBe('TransactionTimedOutError: Timed out')
})

test('uses errno as message when a plain object has no message', () => {
  const result = normalizeModbusError(serialPortErrorWithoutMessage)

  expect(result.message).toBe('ECONNREFUSED')
  expect(result.name).toBe('SerialPortError')
  expect(result.errno).toBe('ECONNREFUSED')
})

test('keeps modbusCode and code of a plain object', () => {
  const original = {
    message: 'Modbus exception 2: Illegal data address',
    modbusCode: 2,
    code: 'ECONNREFUSED',
  }

  const result = normalizeModbusError(original)

  expect(result.message).toBe(original.message)
  expect(result.modbusCode).toBe(2)
  expect(result.code).toBe('ECONNREFUSED')
  expect(result.cause).toBe(original)
})

test('returns an Error instance unchanged', () => {
  // modbus-serial: Modbus exception responses and TCP socket failures are real Errors
  const modbusException = Object.assign(new Error('Modbus exception 4: Slave device failure'), {
    modbusCode: 4,
  })
  const socketError = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:502'), {
    errno: -111,
    code: 'ECONNREFUSED',
  })

  expect(normalizeModbusError(modbusException)).toBe(modbusException)
  expect(normalizeModbusError(socketError)).toBe(socketError)
})

test('ignores properties with unexpected types', () => {
  const result = normalizeModbusError({
    message: 'Odd failure',
    name: 42,
    errno: {},
    code: 5,
    modbusCode: 'two',
  })

  expect(result.message).toBe('Odd failure')
  expect(result.name).toBe('Error')
  expect(result.errno).toBeUndefined()
  expect(result.code).toBeUndefined()
  expect(result.modbusCode).toBeUndefined()
})

test.each([
  { label: 'string', original: 'string error', message: 'string error' },
  { label: 'number', original: 42, message: '42' },
  { label: 'null', original: null, message: 'null' },
  { label: 'undefined', original: undefined, message: 'undefined' },
  { label: 'empty object', original: {}, message: 'Unknown error' },
])('converts $label to an Error with message "$message"', ({ original, message }) => {
  const result = normalizeModbusError(original)

  expect(result).toBeInstanceOf(Error)
  expect(result.message).toBe(message)
  expect(result.cause).toBe(original)
})
