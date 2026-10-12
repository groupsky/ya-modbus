import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Transport } from '@ya-modbus/driver-types'
import yaml from 'js-yaml'

import { runProfileScan } from './cli.js'
import { RegisterType } from './read-tester.js'

jest.mock('chalk')
jest.mock('cli-table3')

describe('runProfileScan', () => {
  let mockConsoleLog: jest.SpyInstance
  let mockConsoleError: jest.SpyInstance

  beforeEach(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation()
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    mockConsoleLog.mockRestore()
    mockConsoleError.mockRestore()
  })

  /**
   * Transport read that answers every register with the same byte pair
   * (a real transport returns two bytes for each register requested)
   */
  function readsWithByte(byte: number): jest.Mock {
    return jest
      .fn()
      .mockImplementation((_address: number, count: number) =>
        Promise.resolve(Buffer.alloc(count * 2, byte))
      )
  }

  it('should scan registers and display progress', async () => {
    const mockTransport: Transport = {
      readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x01, 0x23, 0x45, 0x67])),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport

    await runProfileScan({
      transport: mockTransport,
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 1,
    })

    expect(mockConsoleLog).toHaveBeenCalled()
    expect(mockTransport.close).toHaveBeenCalled()
  })

  it('should scan input registers', async () => {
    const mockTransport: Transport = {
      readInputRegisters: jest.fn().mockResolvedValue(Buffer.from([0xab, 0xcd])),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport

    await runProfileScan({
      transport: mockTransport,
      type: RegisterType.Input,
      startAddress: 100,
      endAddress: 100,
    })

    expect(mockTransport.readInputRegisters).toHaveBeenCalled()
    expect(mockTransport.close).toHaveBeenCalled()
  })

  it('should handle scan errors gracefully', async () => {
    const mockTransport: Transport = {
      readHoldingRegisters: jest.fn().mockRejectedValue(new Error('Connection failed')),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport

    await runProfileScan({
      transport: mockTransport,
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 0,
    })

    expect(mockTransport.close).toHaveBeenCalled()
  })

  it('should display summary table', async () => {
    const mockTransport: Transport = {
      readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x00])),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport

    await runProfileScan({
      transport: mockTransport,
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 0,
    })

    const logOutput = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(logOutput).toContain('Address')
    expect(mockTransport.close).toHaveBeenCalled()
  })

  it('should close transport even if scan fails', async () => {
    const scanError = new Error('Scan failed')
    const mockTransport: Transport = {
      readHoldingRegisters: jest.fn().mockRejectedValue(scanError),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport

    await runProfileScan({
      transport: mockTransport,
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 0,
    })

    expect(mockTransport.close).toHaveBeenCalled()
  })

  it('should respect custom batch size', async () => {
    const mockTransport: Transport = {
      readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x00])),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport

    await runProfileScan({
      transport: mockTransport,
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 5,
      batchSize: 2,
    })

    expect(mockTransport.close).toHaveBeenCalled()
  })

  describe('JSON output format', () => {
    interface PrintedReport {
      connection: { port: string }
      results: Array<{ address: number; success: boolean; value: number | null }>
    }

    /** Parse the single JSON document that the scan printed */
    function printedJSON(): PrintedReport {
      expect(mockConsoleLog).toHaveBeenCalledTimes(1)
      return JSON.parse(mockConsoleLog.mock.calls[0][0] as string) as PrintedReport
    }

    it('should print the scan as one JSON document when format is json', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x12, 0x34])),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 0,
        format: 'json',
        port: '/dev/ttyUSB0',
      })

      expect(printedJSON()).toEqual({
        timestamp: expect.any(String),
        scan: { type: 'holding', startAddress: 0, endAddress: 0, batchSize: 10 },
        connection: { port: '/dev/ttyUSB0' },
        results: [
          { address: 0, type: 'holding', success: true, value: 4660, timing: expect.any(Number) },
        ],
        summary: {
          total: 1,
          successful: 1,
          failed: 0,
          totalTimeMs: expect.any(Number),
          averageTimeMs: expect.any(Number),
        },
      })
      expect(mockTransport.close).toHaveBeenCalled()
    })

    it('should suppress progress output when format is json', async () => {
      const mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation()

      const mockTransport: Transport = {
        readHoldingRegisters: readsWithByte(0x00),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 5,
        format: 'json',
        port: 'localhost:502',
      })

      // Progress should not be written to stdout in JSON mode
      expect(mockStdoutWrite).not.toHaveBeenCalled()
      mockStdoutWrite.mockRestore()

      // The only line on the console is the JSON document
      printedJSON()
    })

    it('should output table when format is table (default)', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x00])),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 0,
        format: 'table',
        port: '/dev/ttyUSB0',
      })

      const logOutput = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
      expect(logOutput).toContain('Address')
      expect(mockTransport.close).toHaveBeenCalled()
    })

    it('should report the scan settings and the values read', async () => {
      const mockTransport: Transport = {
        readInputRegisters: readsWithByte(0xab),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Input,
        startAddress: 100,
        endAddress: 104,
        batchSize: 2,
        format: 'json',
        port: 'localhost:502',
      })

      const output = printedJSON()
      expect(output).toMatchObject({
        scan: { type: 'input', startAddress: 100, endAddress: 104, batchSize: 2 },
        connection: { port: 'localhost:502' },
        summary: { total: 5, successful: 5, failed: 0 },
      })
      expect(output).toHaveProperty(
        'results',
        [100, 101, 102, 103, 104].map((address) =>
          expect.objectContaining({ address, type: 'input', success: true, value: 0xabab })
        )
      )
    })

    it('should report registers that failed to read with their error', async () => {
      // The batch read fails, so the scan falls back to one read per register
      const mockTransport: Transport = {
        readHoldingRegisters: jest
          .fn()
          .mockImplementation((address: number, count: number) =>
            count === 1 && address === 0
              ? Promise.resolve(Buffer.from([0x00, 0x2a]))
              : Promise.reject(new Error('Timeout waiting for response'))
          ),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 1,
        format: 'json',
        port: '/dev/ttyUSB0',
      })

      expect(printedJSON()).toMatchObject({
        results: [
          { address: 0, success: true, value: 42 },
          {
            address: 1,
            success: false,
            value: null,
            error: 'Timeout waiting for response',
            errorType: 'timeout',
          },
        ],
        summary: { total: 2, successful: 1, failed: 1 },
      })
    })

    it('should report an empty port when no port is given', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: readsWithByte(0x00),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 0,
        format: 'json',
      })

      expect(printedJSON().connection.port).toBe('')
    })

    it('should report every register of a large scan', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: readsWithByte(0x01),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 1999,
        batchSize: 100,
        format: 'json',
        port: '/dev/ttyUSB0',
      })

      const { results } = printedJSON()
      expect(results).toHaveLength(2000)
      expect(results.map((result) => result.address)).toEqual(
        Array.from({ length: 2000 }, (_, address) => address)
      )
      expect(results.filter((result) => !result.success || result.value !== 0x0101)).toEqual([])
    })
  })

  describe('YAML output format', () => {
    /** Parse the single YAML document that the scan printed */
    function printedYAML(): unknown {
      expect(mockConsoleLog).toHaveBeenCalledTimes(1)
      return yaml.load(mockConsoleLog.mock.calls[0][0] as string)
    }

    it('should print the scan as one YAML document when format is yaml', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x12, 0x34])),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 0,
        format: 'yaml',
        port: '/dev/ttyUSB0',
      })

      expect(printedYAML()).toEqual({
        timestamp: expect.any(String),
        scan: { type: 'holding', startAddress: 0, endAddress: 0, batchSize: 10 },
        connection: { port: '/dev/ttyUSB0' },
        results: [
          { address: 0, type: 'holding', success: true, value: 4660, timing: expect.any(Number) },
        ],
        summary: {
          total: 1,
          successful: 1,
          failed: 0,
          totalTimeMs: expect.any(Number),
          averageTimeMs: expect.any(Number),
        },
      })
      expect(mockTransport.close).toHaveBeenCalled()
    })

    it('should suppress progress output when format is yaml', async () => {
      const mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation()

      const mockTransport: Transport = {
        readHoldingRegisters: readsWithByte(0x00),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      try {
        await runProfileScan({
          transport: mockTransport,
          type: RegisterType.Holding,
          startAddress: 0,
          endAddress: 5,
          format: 'yaml',
          port: 'localhost:502',
        })

        expect(mockStdoutWrite).not.toHaveBeenCalled()
      } finally {
        mockStdoutWrite.mockRestore()
      }

      // The only line on the console is the YAML document
      printedYAML()
    })

    it('should report registers that failed to read with their error', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockRejectedValue(new Error('Timeout: no response')),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 0,
        format: 'yaml',
        port: '/dev/ttyUSB0',
      })

      expect(printedYAML()).toMatchObject({
        results: [
          {
            address: 0,
            success: false,
            value: null,
            error: 'Timeout: no response',
            errorType: 'timeout',
          },
        ],
        summary: { total: 1, successful: 0, failed: 1 },
      })
    })
  })

  describe('output file', () => {
    let directory: string
    let mockStdoutWrite: jest.SpyInstance

    beforeEach(async () => {
      directory = await mkdtemp(join(tmpdir(), 'profiler-cli-'))
      mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation()
    })

    afterEach(async () => {
      mockStdoutWrite.mockRestore()
      await rm(directory, { recursive: true, force: true })
    })

    function createTransport(read: jest.Mock): Transport {
      return {
        readHoldingRegisters: read,
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport
    }

    it('should write the JSON document to the file', async () => {
      const file = join(directory, 'scan.json')

      await runProfileScan({
        transport: createTransport(readsWithByte(0x12)),
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 1,
        format: 'json',
        outputFile: file,
        port: '/dev/ttyUSB0',
      })

      const content = await readFile(file, 'utf8')
      expect(content).toMatch(/\n$/)
      expect(JSON.parse(content)).toMatchObject({
        scan: { type: 'holding', startAddress: 0, endAddress: 1 },
        connection: { port: '/dev/ttyUSB0' },
        results: [
          { address: 0, success: true, value: 0x1212 },
          { address: 1, success: true, value: 0x1212 },
        ],
        summary: { total: 2, successful: 2, failed: 0 },
      })
    })

    it('should write the YAML document to the file', async () => {
      const file = join(directory, 'scan.yaml')

      await runProfileScan({
        transport: createTransport(readsWithByte(0x12)),
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 1,
        format: 'yaml',
        outputFile: file,
        port: '/dev/ttyUSB0',
      })

      const content = await readFile(file, 'utf8')
      expect(content).toMatch(/[^\n]\n$/)
      expect(yaml.load(content)).toMatchObject({
        scan: { type: 'holding', startAddress: 0, endAddress: 1 },
        results: [
          { address: 0, success: true, value: 0x1212 },
          { address: 1, success: true, value: 0x1212 },
        ],
        summary: { total: 2, successful: 2, failed: 0 },
      })
    })

    it('should replace the content of an existing file', async () => {
      const file = join(directory, 'scan.json')
      await writeFile(file, 'old content that is longer than the new document'.repeat(100))

      await runProfileScan({
        transport: createTransport(readsWithByte(0x00)),
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 0,
        format: 'json',
        outputFile: file,
      })

      expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ summary: { total: 1 } })
    })

    it.each(['json', 'yaml'] as const)(
      'should keep stdout empty and put no progress in the %s file',
      async (format) => {
        const file = join(directory, 'scan')

        await runProfileScan({
          transport: createTransport(readsWithByte(0x00)),
          type: RegisterType.Holding,
          startAddress: 0,
          endAddress: 5,
          format,
          outputFile: file,
        })

        expect(mockConsoleLog).not.toHaveBeenCalled()
        expect(mockStdoutWrite).not.toHaveBeenCalled()
        expect(await readFile(file, 'utf8')).not.toContain('Progress')
      }
    )

    it('should print a one-line summary to stderr', async () => {
      const file = join(directory, 'scan.json')
      // The batch read fails, then register 0 succeeds and register 1 fails
      const read = jest
        .fn()
        .mockImplementation((address: number, count: number) =>
          count === 1 && address === 0
            ? Promise.resolve(Buffer.from([0x00, 0x2a]))
            : Promise.reject(new Error('Timeout waiting for response'))
        )

      await runProfileScan({
        transport: createTransport(read),
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 1,
        format: 'json',
        outputFile: file,
      })

      expect(mockConsoleError).toHaveBeenCalledTimes(1)
      expect(mockConsoleError).toHaveBeenCalledWith(`Wrote 2 registers (1 ok, 1 failed) to ${file}`)
    })

    describe('when the file cannot be written after the scan', () => {
      let stdout: string[]
      let missingDirectoryFile: string

      beforeEach(() => {
        stdout = []
        missingDirectoryFile = join(directory, 'missing', 'scan.json')
        // The write callback is how a caller learns that the output reached the stream
        mockStdoutWrite.mockImplementation((chunk: string | Uint8Array, ...rest: unknown[]) => {
          stdout.push(String(chunk))
          const callback = rest.find((argument) => typeof argument === 'function')
          ;(callback as (() => void) | undefined)?.()
          return true
        })
      })

      function scan(transport: Transport, format: 'json' | 'yaml'): Promise<void> {
        return runProfileScan({
          transport,
          type: RegisterType.Holding,
          startAddress: 0,
          endAddress: 1,
          format,
          outputFile: missingDirectoryFile,
          port: '/dev/ttyUSB0',
        })
      }

      // The scan can take minutes, so its result must not be lost with the file
      it.each([
        { format: 'json' as const, parse: JSON.parse },
        { format: 'yaml' as const, parse: yaml.load },
      ])('should print the $format report to stdout', async ({ format, parse }) => {
        await expect(scan(createTransport(readsWithByte(0x12)), format)).rejects.toThrow()

        const printed = stdout.join('')
        expect(printed).toMatch(/[^\n]\n$/)
        expect(parse(printed)).toMatchObject({
          scan: { type: 'holding', startAddress: 0, endAddress: 1 },
          connection: { port: '/dev/ttyUSB0' },
          results: [
            { address: 0, success: true, value: 0x1212 },
            { address: 1, success: true, value: 0x1212 },
          ],
          summary: { total: 2, successful: 2, failed: 0 },
        })
        expect(mockConsoleLog).not.toHaveBeenCalled()
      })

      it('should fail with an error that names the file, the reason and where the report went', async () => {
        await expect(scan(createTransport(readsWithByte(0x12)), 'json')).rejects.toThrow(
          new RegExp(
            `^Cannot write to ${missingDirectoryFile}: ENOENT.*\\. The report is printed to stdout instead\\.$`
          )
        )

        expect(mockConsoleError).not.toHaveBeenCalledWith(expect.stringContaining('Wrote'))
      })

      it('should close the transport', async () => {
        const transport = createTransport(readsWithByte(0x00))

        await expect(scan(transport, 'json')).rejects.toThrow()

        expect(transport.close).toHaveBeenCalled()
      })

      it('should wait until the report is written to stdout before it fails', async () => {
        let finishWrite: (() => void) | undefined
        mockStdoutWrite.mockImplementation((_chunk: string | Uint8Array, ...rest: unknown[]) => {
          finishWrite = rest.find((argument) => typeof argument === 'function') as () => void
          return true
        })
        const settled = jest.fn()

        const result = scan(createTransport(readsWithByte(0x00)), 'json').catch(settled)
        while (finishWrite === undefined) {
          await new Promise((resolve) => setTimeout(resolve, 1))
        }

        // The process exits as soon as the error is reported, which would cut the report short
        expect(settled).not.toHaveBeenCalled()

        finishWrite()
        await result
        expect(settled).toHaveBeenCalledTimes(1)
      })
    })
  })
})
