import type { BaudRate, DataBits, Parity, StopBits, Transport } from '@ya-modbus/driver-types'
import ModbusRTU from 'modbus-serial'

import { configureClient } from './client-config.js'
import { ModbusConnection } from './connection.js'
import { createModbusTransport } from './create-modbus-transport.js'
import { formatSerialSettings, withRequestContext } from './request-context.js'
import type { RetryLogger } from './retry.js'

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
  /** Maximum retry attempts (default: 3, use 1 to disable retries) */
  maxRetries?: number | undefined
  /** Optional callback to log retry attempts for debugging */
  logger?: RetryLogger | undefined
}

/**
 * Create an RTU transport
 *
 * When the serial port is lost (for example the USB adapter is unplugged), requests
 * reject with a ConnectionLostError and the port is reopened on a later request
 * (see ModbusConnection).
 *
 * @param config - RTU configuration
 * @returns Transport implementation for RTU
 */
export async function createRTUTransport(config: RTUConfig): Promise<Transport> {
  const open = async (): Promise<ModbusRTU> => {
    const client = new ModbusRTU()

    // Connect to serial port
    await client.connectRTUBuffered(config.port, {
      baudRate: config.baudRate,
      dataBits: config.dataBits,
      parity: config.parity,
      stopBits: config.stopBits,
    })

    configureClient(client, config.slaveId, config.timeout)
    return client
  }

  const connection = new ModbusConnection(await open(), config.port, open)
  return withRequestContext(
    createModbusTransport(connection, config.maxRetries, config.logger),
    `${config.port} ${formatSerialSettings(config)}, slave ${config.slaveId}`
  )
}
