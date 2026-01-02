/**
 * Device-related types
 */

export interface EmulatedDevice {
  /** Slave ID */
  slaveId: number
  /** Get holding register value */
  getHoldingRegister(address: number): number
  /** Set holding register value */
  setHoldingRegister(address: number, value: number): void
  /** Get input register value */
  getInputRegister(address: number): number
  /** Set input register value */
  setInputRegister(address: number, value: number): void
  /** Get coil value */
  getCoil(address: number): boolean
  /** Set coil value */
  setCoil(address: number, value: boolean): void
  /** Get discrete input value */
  getDiscreteInput(address: number): boolean
  /** Set discrete input value */
  setDiscreteInput(address: number, value: boolean): void
}
