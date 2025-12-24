// Mock cli-table3 for Jest tests
class MockTable extends Array {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(options?: unknown) {
    super()
  }

  toString(): string {
    return this.map((row) => (row as unknown[]).join(' | ')).join('\n')
  }
}

export default MockTable
