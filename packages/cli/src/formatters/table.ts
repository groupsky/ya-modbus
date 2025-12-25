import type { DataPoint } from '@ya-modbus/driver-types'
import chalk from 'chalk'
import Table from 'cli-table3'

/**
 * Convert unknown value to string representation
 *
 * @param value - Value to stringify
 * @returns String representation
 */
function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  // For objects/arrays, use JSON to avoid '[object Object]'
  return JSON.stringify(value)
}

/**
 * Format a value based on data point metadata
 *
 * @param value - Raw value
 * @param dataPoint - Data point definition
 * @returns Formatted string
 */
function formatValue(value: unknown, dataPoint: DataPoint): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return chalk.gray('N/A')
  }

  // Format based on type
  switch (dataPoint.type) {
    case 'float': {
      const num = value as number
      const decimals = dataPoint.decimals ?? 2
      return num.toFixed(decimals)
    }

    case 'integer':
      return stringifyValue(value)

    case 'boolean':
      return value ? chalk.green('true') : chalk.red('false')

    case 'enum': {
      if (dataPoint.enumValues) {
        const enumKey = stringifyValue(value)
        return dataPoint.enumValues[enumKey] ?? stringifyValue(value)
      }
      return stringifyValue(value)
    }

    case 'timestamp': {
      if (value instanceof Date) {
        return value.toISOString()
      }
      return stringifyValue(value)
    }

    case 'string':
      return stringifyValue(value)

    default:
      return stringifyValue(value)
  }
}

/**
 * Format data point results as a table
 *
 * @param dataPoints - Data point definitions
 * @param values - Data point values (keyed by ID)
 * @returns Formatted table string
 */
export function formatTable(
  dataPoints: ReadonlyArray<DataPoint>,
  values: Record<string, unknown>
): string {
  // Create table with headers
  const table = new Table({
    head: [chalk.bold('Data Point'), chalk.bold('Value'), chalk.bold('Unit')],
    style: {
      head: ['cyan'],
    },
  })

  // Add rows for each data point that has a value
  for (const dp of dataPoints) {
    if (!(dp.id in values)) {
      continue
    }

    const displayName = dp.name ?? dp.id
    const formattedValue = formatValue(values[dp.id], dp)
    const unit = dp.unit ?? ''

    table.push([displayName, formattedValue, unit])
  }

  return table.toString()
}
