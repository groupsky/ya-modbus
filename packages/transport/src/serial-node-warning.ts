/**
 * Get the warning for Node.js versions on which serial (RTU) requests time out
 *
 * Since Node.js 26.4.0, Node does not run pending promise work after a native addon calls
 * into JavaScript without `MakeCallback` (nodejs/node#66158). The serialport poller does
 * that, so received data waits and the request times out (serialport/bindings-cpp#239).
 * Modbus TCP is not affected.
 *
 * @param nodeVersion - Node.js version as in `process.version` ('v26.4.0') or
 *   `process.versions.node` ('26.4.0')
 * @returns The warning text, or undefined when serial requests work on this version
 */
export function getSerialNodeWarning(nodeVersion: string): string | undefined {
  const [major, minor] = nodeVersion.replace(/^v/, '').split('.').map(Number) as [number, number]
  if (major < 26 || (major === 26 && minor < 4)) return undefined

  return (
    `Warning: on Node.js 26.4 and newer, serial (RTU) requests time out (this is Node.js ${nodeVersion}). ` +
    'Use Node.js 22.12+ or 24. See https://github.com/groupsky/ya-modbus/issues/507'
  )
}
