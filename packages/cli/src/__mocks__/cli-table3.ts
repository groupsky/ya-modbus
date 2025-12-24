// Mock cli-table3 for Jest tests
interface TableOptions {
  head?: string[]
  style?: { head?: string[] }
}

class MockTable extends Array {
  private head: string[] | undefined

  constructor(options?: TableOptions) {
    super()
    this.head = options?.head
  }

  toString(): string {
    const rows: string[] = []

    // Add header row if present
    if (this.head) {
      rows.push(this.head.join(' | '))
    }

    // Add data rows
    for (const row of this) {
      rows.push((row as unknown[]).join(' | '))
    }

    return rows.join('\n')
  }
}

export default MockTable
