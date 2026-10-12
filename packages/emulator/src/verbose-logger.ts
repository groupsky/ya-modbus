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

    const values =
      functionCode === 0x01 || functionCode === 0x02
        ? this.parseBitResponse(response, count)
        : this.parseReadResponse(response)
    const formattedValues = this.formatValues(values)
    console.log(this.formatMessage('READ', slaveId, functionCode, address, count, formattedValues))
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

    const formattedValues = this.formatValues(values)
    console.log(this.formatMessage('WRITE', slaveId, functionCode, address, count, formattedValues))
  }

  private formatHex(value: number, width: number): string {
    return `0x${value.toString(16).toUpperCase().padStart(width, '0')}`
  }

  private formatValues(values: number[]): string {
    return values.map((v) => this.formatHex(v, 4)).join(', ')
  }

  private formatMessage(
    operation: 'READ' | 'WRITE',
    slaveId: number,
    functionCode: number,
    address: number,
    count: number,
    formattedValues: string
  ): string {
    return `[VERBOSE] ${operation} slave=${slaveId} func=${this.formatHex(functionCode, 2)} addr=${this.formatHex(address, 4)} count=${count} values=[${formattedValues}]`
  }

  // Response format: [slaveId, functionCode, byteCount, ...data], the lowest address in the
  // least significant bit of the first data byte. Gives one value, 0 or 1, per bit.
  private parseBitResponse(response: Buffer, count: number): number[] {
    const values: number[] = []
    for (let i = 0; i < count; i++) {
      const byte = response[3 + (i >> 3)]
      if (byte === undefined) {
        break
      }
      values.push((byte >> (i & 7)) & 1)
    }
    return values
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
