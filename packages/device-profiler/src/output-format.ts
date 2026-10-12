/**
 * Output formats of the profiler
 */

/** Formats the scan result can be printed in */
export const OUTPUT_FORMATS = ['table', 'json', 'yaml'] as const

export type OutputFormat = (typeof OUTPUT_FORMATS)[number]
