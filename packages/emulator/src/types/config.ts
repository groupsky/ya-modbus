/**
 * Configuration types for the Modbus emulator
 */

export interface EmulatorConfig {
  /** Transport type */
  transport: 'tcp' | 'rtu' | 'memory'
  /** Port number (TCP) or serial port path (RTU) */
  port?: number | string
  /** Host address for TCP transport */
  host?: string
  /** Maximum number of connections (TCP) */
  maxConnections?: number
  /** Baud rate for RTU transport */
  baudRate?: number
  /** Parity for RTU transport */
  parity?: 'none' | 'even' | 'odd'
  /** Stop bits for RTU transport */
  stopBits?: 1 | 2
  /** Data bits for RTU transport */
  dataBits?: 7 | 8
}

export interface RegisterStorage {
  /** Holding registers (read/write) */
  holding?: Record<number, number>
  /** Input registers (read-only) */
  input?: Record<number, number>
  /** Coils (read/write bits) */
  coils?: Record<number, boolean>
  /** Discrete inputs (read-only bits) */
  discreteInputs?: Record<number, boolean>
}

export interface TimingBehavior {
  /** Time device takes to notice incoming command (ms) */
  commandDetectionDelay?: number | [min: number, max: number]
  /** Internal polling interval (ms) - realistic: 1-100ms */
  pollingInterval?: number
  /** Base processing time per command (ms) */
  processingDelay?: number | [min: number, max: number]
  /** Additional delay per register read/written (ms) */
  perRegisterDelay?: number
  /** Baud rate (affects transmission time for RTU) */
  baudRate?: number
  /** Auto-calculate transmission delay based on frame size */
  autoCalculateTransmissionDelay?: boolean
}

export interface DeviceConfig {
  /** Slave ID (1-247) */
  slaveId: number
  /** Initial register values */
  registers?: RegisterStorage
  /** Timing behavior configuration */
  timing?: TimingBehavior
}
