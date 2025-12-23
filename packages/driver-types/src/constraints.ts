/**
 * Device constraints and limitations
 */

/**
 * Modbus register type
 */
export type RegisterType = 'coil' | 'discrete' | 'input' | 'holding';

/**
 * Forbidden register range
 */
export interface ForbiddenRange {
  /** Register type */
  type: RegisterType;

  /** Start address (inclusive) */
  start: number;

  /** End address (inclusive) */
  end: number;

  /** Optional reason for restriction */
  reason?: string;
}

/**
 * Device constraints
 */
export interface DeviceConstraints {
  /** Maximum number of registers that can be read in single operation */
  maxReadRegisters?: number;

  /** Maximum number of registers that can be written in single operation */
  maxWriteRegisters?: number;

  /** Maximum number of coils that can be read in single operation */
  maxReadCoils?: number;

  /** Maximum number of coils that can be written in single operation */
  maxWriteCoils?: number;

  /** Minimum delay between commands (milliseconds) */
  minCommandDelay?: number;

  /** Forbidden register ranges (cannot read or write) */
  forbiddenRanges?: ForbiddenRange[];

  /** Read-only register ranges */
  readOnlyRanges?: ForbiddenRange[];

  /** Write-only register ranges */
  writeOnlyRanges?: ForbiddenRange[];
}
