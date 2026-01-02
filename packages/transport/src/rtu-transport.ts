import type { BaudRate, DataBits, Parity, StopBits, Transport } from '@ya-modbus/driver-types'
import ModbusRTU from 'modbus-serial'

import { createModbusTransport } from './create-modbus-transport.js'

/**
 * RTU transport configuration
 */
export interface RTUConfig {
  /** Serial port path (e.g., /dev/ttyUSB0, COM1) */
  port: string
  /** Baud rate */
  baudRate: BaudRate
  /** Data bits */
  dataBits: DataBits
  /** Parity */
  parity: Parity
  /** Stop bits */
  stopBits: StopBits
  /** Modbus slave ID (1-247) */
  slaveId: number
  /** Response timeout in milliseconds (default: 1000) */
  timeout?: number | undefined
}

/**
 * Create an RTU transport
 *
 * @param config - RTU configuration
 * @returns Transport implementation for RTU
 */
export async function createRTUTransport(config: RTUConfig): Promise<Transport> {
  const client = new ModbusRTU()

  // Connect to serial port
  await client.connectRTUBuffered(config.port, {
    baudRate: config.baudRate,
    dataBits: config.dataBits,
    parity: config.parity,
    stopBits: config.stopBits,
  })

  // Set slave ID
  client.setID(config.slaveId)

  // Set timeout
  client.setTimeout(config.timeout ?? 1000)

  return createModbusTransport(client)
}
