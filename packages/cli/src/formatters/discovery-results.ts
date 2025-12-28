import Table from 'cli-table3'

import type { DiscoveredDevice } from '../discovery/scanner.js'

/**
 * Format discovered devices as a table
 */
export function formatDiscoveryTable(devices: DiscoveredDevice[]): string {
  if (devices.length === 0) {
    return 'No devices found.'
  }

  const table = new Table({
    head: ['Slave ID', 'Baud Rate', 'Parity', 'Data/Stop', 'Response', 'Vendor', 'Model'],
    style: {
      head: ['cyan'],
    },
  })

  // Sort by slave ID
  const sorted = [...devices].sort((a, b) => a.slaveId - b.slaveId)

  for (const device of sorted) {
    const { slaveId, baudRate, parity, dataBits, stopBits, identification } = device

    const parityChar = parity === 'none' ? 'N' : parity === 'even' ? 'E' : 'O'
    const dataStop = `${dataBits}${parityChar}${stopBits}`

    const vendor = identification.vendorName ?? '-'
    const model = identification.modelName ?? identification.productCode ?? '-'
    const responseTime = `${Math.round(identification.responseTimeMs)}ms`

    table.push([
      slaveId.toString(),
      baudRate.toString(),
      parityChar,
      dataStop,
      responseTime,
      vendor,
      model,
    ])
  }

  return table.toString()
}

/**
 * Format discovered devices as JSON
 */
export function formatDiscoveryJSON(devices: DiscoveredDevice[]): string {
  const formatted = devices.map((device) => ({
    slaveId: device.slaveId,
    baudRate: device.baudRate,
    parity: device.parity,
    dataBits: device.dataBits,
    stopBits: device.stopBits,
    responseTimeMs: device.identification.responseTimeMs,
    identification: {
      vendorName: device.identification.vendorName,
      productCode: device.identification.productCode,
      modelName: device.identification.modelName,
      revision: device.identification.revision,
      supportsFC43: device.identification.supportsFC43,
    },
  }))

  return JSON.stringify(formatted, null, 2)
}
