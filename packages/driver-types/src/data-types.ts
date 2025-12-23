/**
 * Standard data types and data point definitions
 */

import type { Unit } from './units.js';

/**
 * Standard data types for data points
 */
export type DataType =
  | 'float'      // Floating-point number
  | 'integer'    // Whole number
  | 'boolean'    // True/false
  | 'string'     // Text value
  | 'timestamp'  // ISO 8601 timestamp
  | 'enum';      // Enumerated value

/**
 * Polling type for data points
 */
export type PollType =
  | 'dynamic'    // Frequently changing values (default polling)
  | 'static'     // Unchanging values (read once at startup)
  | 'on-demand'; // Only read when explicitly requested

/**
 * Access permissions for data points
 */
export type AccessMode = 'r' | 'w' | 'rw';

/**
 * Data point definition (semantic interface)
 */
export interface DataPoint {
  /** Unique identifier for this data point */
  id: string;

  /** Human-readable name */
  name?: string;

  /** Data type */
  type: DataType;

  /** Unit of measurement */
  unit?: Unit;

  /** Polling behavior */
  pollType?: PollType;

  /** Access permissions */
  access?: AccessMode;

  /** Optional description */
  description?: string;

  /** For enum type: valid values */
  enumValues?: Record<string | number, string>;

  /** Minimum valid value (for numeric types) */
  min?: number;

  /** Maximum valid value (for numeric types) */
  max?: number;

  /** Number of decimal places for display */
  decimals?: number;
}
