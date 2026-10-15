/**
 * Context for failed requests: which port, slave, function and registers
 */

import type { Transport } from '@ya-modbus/driver-types'

import { normalizeModbusError, type ModbusError } from './normalize-error.js'

/** How each request of a Transport is named in error messages, and how many items it covers */
const REQUESTS: Record<
  Exclude<keyof Transport, 'close'>,
  { code: number; name: string; count: (value: number | boolean | Buffer) => number }
> = {
  readCoils: { code: 1, name: 'read coils', count: (n) => n as number },
  readDiscreteInputs: { code: 2, name: 'read discrete inputs', count: (n) => n as number },
  readHoldingRegisters: { code: 3, name: 'read holding registers', count: (n) => n as number },
  readInputRegisters: { code: 4, name: 'read input registers', count: (n) => n as number },
  writeSingleCoil: { code: 5, name: 'write single coil', count: () => 1 },
  writeSingleRegister: { code: 6, name: 'write single register', count: () => 1 },
  writeMultipleCoils: {
    code: 15,
    name: 'write multiple coils',
    count: (values) => (values as Buffer).length * 8,
  },
  writeMultipleRegisters: {
    code: 16,
    name: 'write multiple registers',
    count: (values) => (values as Buffer).length / 2,
  },
}

/**
 * Serial settings in the usual short form, from the settings that are present
 *
 * @example formatSerialSettings({ baudRate: 9600, dataBits: 8, parity: 'even', stopBits: 1 }) // '9600 8E1'
 */
export function formatSerialSettings(settings: {
  baudRate?: number | undefined
  dataBits?: number | undefined
  parity?: string | undefined
  stopBits?: number | undefined
}): string {
  const { baudRate, dataBits, parity, stopBits } = settings
  const frame = `${dataBits ?? ''}${parity?.charAt(0).toUpperCase() ?? ''}${stopBits ?? ''}`
  return [baudRate, frame].filter((part) => part !== undefined && part !== '').join(' ')
}

/**
 * Copy of an error with a new message
 *
 * Name, code, errno, modbusCode and cause stay, and the stack starts with the new message.
 * The error is copied because a lost connection rejects all requests with the same
 * object, and the details of one request must not pile up on it.
 */
function withMessage(error: ModbusError, message: string): ModbusError {
  const copy: ModbusError = Object.assign(
    new Error(message, error.cause === undefined ? undefined : { cause: error.cause }),
    error
  )
  copy.message = message
  copy.name = error.name
  if (error.stack !== undefined && error.message !== '') {
    copy.stack = error.stack.replace(error.message, () => message)
  }
  return copy
}

/**
 * Wrap a Transport so that a failed request says where it went
 *
 * The error message gets the label and the request appended, for example
 * `Timed out (/dev/ttyUSB0 9600 8E1, slave 1, FC03 read holding registers, address 16 (0x0010), count 2)`.
 * Retries of the wrapped transport are not changed.
 *
 * @param transport - Transport to wrap
 * @param label - Port or host, serial settings and slave, shown in the message
 */
export function withRequestContext(transport: Transport, label: string): Transport {
  const wrapped = { close: () => transport.close() } as Record<string, unknown>
  for (const [method, request] of Object.entries(REQUESTS)) {
    wrapped[method] = async (address: number, value: number | boolean | Buffer) => {
      try {
        return await (
          transport[method as keyof typeof REQUESTS] as (...args: unknown[]) => Promise<unknown>
        )(address, value)
      } catch (error) {
        const normalized = normalizeModbusError(error)
        const hex = `0x${address.toString(16).toUpperCase().padStart(4, '0')}`
        const code = String(request.code).padStart(2, '0')
        throw withMessage(
          normalized,
          `${normalized.message} (${label}, FC${code} ${request.name}, address ${address} (${hex}), count ${request.count(value)})`
        )
      }
    }
  }
  return wrapped as unknown as Transport
}
