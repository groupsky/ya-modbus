import { parseInteger } from './parse-integer.js'
import { parseSpec } from './parse-spec.js'

/**
 * Parses a comma-separated list of IDs and ranges into a sorted array of unique IDs.
 *
 * @param spec - ID specification string (e.g., "1,2,3-5")
 * @returns Sorted array of unique Modbus slave IDs (1-247)
 *
 * @example
 * parseIdRange("1,2,3-5") // [1, 2, 3, 4, 5]
 * parseIdRange("5,1,3") // [1, 3, 5]
 * parseIdRange("1-3,2-4") // [1, 2, 3, 4]
 */
export function parseIdRange(spec: string): number[] {
  return parseSpec({
    spec,
    label: 'ID',
    formatExamples: ['"1,2,3"', '"1-5"'],
    skipEmptyParts: true,
    parseSingle: (value, context) => {
      const id = parseInteger(value, context, 'ID')
      validateModbusAddress(id, context)
      return id
    },
    parseRange: (start, end, context) => {
      const startId = parseInteger(start, context, 'ID')
      const endId = parseInteger(end, context, 'ID')

      if (startId > endId) {
        throw new Error(`Invalid range: "${context}". Start must be less than or equal to end`)
      }

      validateModbusAddress(startId, context)
      validateModbusAddress(endId, context)

      return Array.from({ length: endId - startId + 1 }, (_, i) => startId + i)
    },
    sortItems: (items) => items.sort((a, b) => a - b),
  })
}

/**
 * Validates that a number is a valid Modbus slave address (1-247).
 */
function validateModbusAddress(id: number, context: string): void {
  if (id < 1 || id > 247) {
    throw new Error(
      `Invalid Modbus slave address: ${id} in "${context}". ` + `Valid addresses are 1-247`
    )
  }
}
