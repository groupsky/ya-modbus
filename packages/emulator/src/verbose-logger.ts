/**
 * Verbose logger for Modbus operations
 */

export class VerboseLogger {
  constructor(private enabled: boolean) {}

  logRead(
    slaveId: number,
    functionCode: number,
    address: number,
    count: number,
    response: Buffer
  ): void {
    if (!this.enabled) {
      return
    }

    const values = this.parseReadResponse(response)
    const formattedValues = values.map((v) => `0x${v.toString(16).toUpperCase().padStart(4, '0')}`)

    console.log(
      `[VERBOSE] READ slave=${slaveId} func=0x${functionCode.toString(16).toUpperCase().padStart(2, '0')} addr=0x${address.toString(16).toUpperCase().padStart(4, '0')} count=${count} values=[${formattedValues.join(', ')}]`
    )
  }

  logWrite(
    slaveId: number,
    functionCode: number,
    address: number,
    count: number,
    values: number[]
  ): void {
    if (!this.enabled) {
      return
    }

    const formattedValues = values.map((v) => `0x${v.toString(16).toUpperCase().padStart(4, '0')}`)

    console.log(
      `[VERBOSE] WRITE slave=${slaveId} func=0x${functionCode.toString(16).toUpperCase().padStart(2, '0')} addr=0x${address.toString(16).toUpperCase().padStart(4, '0')} count=${count} values=[${formattedValues.join(', ')}]`
    )
  }

  private parseReadResponse(response: Buffer): number[] {
    // Response format: [slaveId, functionCode, byteCount, ...data]
    if (response.length < 3) {
      return []
    }

    const byteCount = response[2]
    if (byteCount === undefined || response.length < 3 + byteCount) {
      // Attempt to parse what we have
      const values: number[] = []
      for (let i = 3; i < response.length; i += 2) {
        if (i + 1 < response.length) {
          values.push(response.readUInt16BE(i))
        }
      }
      return values
    }

    const registerCount = byteCount / 2
    const values: number[] = []

    for (let i = 0; i < registerCount; i++) {
      const offset = 3 + i * 2
      if (offset + 1 < response.length) {
        values.push(response.readUInt16BE(offset))
      }
    }

    return values
  }
}
