import { resolveOutput } from './output-format.js'

describe('resolveOutput', () => {
  it.each([
    { format: undefined, expected: 'table' },
    { format: 'table', expected: 'table' },
    { format: 'json', expected: 'json' },
    { format: 'yaml', expected: 'yaml' },
  ] as const)('should print the $expected format when --format is $format', (item) => {
    expect(resolveOutput(item.format, undefined)).toEqual({ format: item.expected })
  })

  it.each([
    { file: 'scan.json', expected: 'json' },
    { file: 'scan.yaml', expected: 'yaml' },
    { file: 'scan.yml', expected: 'yaml' },
    { file: 'SCAN.JSON', expected: 'json' },
    { file: 'SCAN.Yml', expected: 'yaml' },
    { file: '/tmp/results.v2/scan.json', expected: 'json' },
    { file: 'scan.backup.yaml', expected: 'yaml' },
  ] as const)('should write $expected to $file when --format is not given', (item) => {
    expect(resolveOutput(undefined, item.file)).toEqual({
      format: item.expected,
      file: item.file,
    })
  })

  it.each([
    { format: 'yaml', file: 'scan.json' },
    { format: 'json', file: 'scan.yaml' },
    { format: 'json', file: 'scan.txt' },
    { format: 'yaml', file: 'scan' },
  ] as const)('should write $format to $file when --format is given', (item) => {
    expect(resolveOutput(item.format, item.file)).toEqual({ format: item.format, file: item.file })
  })

  it.each(['scan.txt', 'scan', 'scan.json.bak', '.json', '/tmp/results.json/scan', 'scan.'])(
    'should reject the file %s when --format is not given',
    (file) => {
      expect(() => resolveOutput(undefined, file)).toThrow(
        `Cannot tell the output format from "${file}". Use a .json, .yaml or .yml file name, or set --format json or --format yaml`
      )
    }
  )

  it('should reject the table format for a file', () => {
    expect(() => resolveOutput('table', 'scan.json')).toThrow(
      'The table format cannot be written to a file. Use --format json or --format yaml'
    )
  })
})
