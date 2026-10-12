/**
 * Output formats of the profiler
 */

import { extname } from 'node:path'

/** Formats the scan result can be printed in */
export const OUTPUT_FORMATS = ['table', 'json', 'yaml'] as const

export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

/** Output format named by a file extension */
const FORMAT_BY_EXTENSION: Record<string, OutputFormat> = {
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
}

/**
 * Where and how the result is written
 */
export interface OutputTarget {
  format: OutputFormat
  /** File to write to; the result is printed when absent */
  file?: string
}

/**
 * Decide the output format from --format and --output
 *
 * Without a file the format is --format, or table. With a file the format is
 * --format, or the one the file extension names (.json, .yaml, .yml).
 *
 * @param format - Value of --format, if given
 * @param file - Value of --output, if given
 * @throws Error if the table format is asked for a file, or the format cannot be told
 */
export function resolveOutput(
  format: OutputFormat | undefined,
  file: string | undefined
): OutputTarget {
  if (file === undefined) {
    return { format: format ?? 'table' }
  }

  if (format === 'table') {
    throw new Error(
      'The table format cannot be written to a file. Use --format json or --format yaml'
    )
  }

  const fileFormat = format ?? FORMAT_BY_EXTENSION[extname(file).toLowerCase()]
  if (fileFormat === undefined) {
    throw new Error(
      `Cannot tell the output format from "${file}". Use a .json, .yaml or .yml file name, or set --format json or --format yaml`
    )
  }

  return { format: fileFormat, file }
}
