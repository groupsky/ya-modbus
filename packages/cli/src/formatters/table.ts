import Table from 'cli-table3'
import chalk from 'chalk'
import type { DataPoint } from '@ya-modbus/driver-types'

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
      return String(value)

    case 'boolean':
      return value ? chalk.green('true') : chalk.red('false')

    case 'enum': {
      if (dataPoint.enumValues) {
        const enumKey = String(value)
        return dataPoint.enumValues[enumKey] || String(value)
      }
      return String(value)
    }

    case 'timestamp': {
      if (value instanceof Date) {
        return value.toISOString()
      }
      return String(value)
    }

    case 'string':
      return String(value)

    default:
      return String(value)
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
    head: [
      chalk.bold('Data Point'),
      chalk.bold('Value'),
      chalk.bold('Unit'),
    ],
    style: {
      head: ['cyan'],
    },
  })

  // Add rows for each data point that has a value
  for (const dp of dataPoints) {
    if (!(dp.id in values)) {
      continue
    }

    const displayName = dp.name || dp.id
    const formattedValue = formatValue(values[dp.id], dp)
    const unit = dp.unit || ''

    table.push([displayName, formattedValue, unit])
  }

  return table.toString()
}
