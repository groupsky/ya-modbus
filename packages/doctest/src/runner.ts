/**
 * Documentation test runner
 *
 * Executes code blocks from markdown files against the emulator
 * and verifies outputs match expected values in comments.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { ModbusEmulator } from '@ya-modbus/emulator'

import { createClientTransport } from './client-transport.js'
import { extractExpectedOutputs, assertOutput } from './extractor.js'
import { parseMarkdown, getTestableBlocks, type CodeBlock } from './parser.js'

export interface TestResult {
  filePath: string
  blockIndex: number
  lineNumber: number
  success: boolean
  message: string
  error?: Error
}

export interface RunOptions {
  /** Verbose output */
  verbose?: boolean
  /** Stop on first failure */
  bail?: boolean
}

/**
 * Run documentation tests for a single markdown file
 */
export async function runDocTests(
  filePath: string,
  options: RunOptions = {}
): Promise<TestResult[]> {
  const results: TestResult[] = []

  // Read and parse markdown
  const absolutePath = path.resolve(filePath)
  const content = await readFile(absolutePath, 'utf-8')
  const allBlocks = parseMarkdown(content, absolutePath)
  const blocks = getTestableBlocks(allBlocks)

  if (options.verbose) {
    console.log(`Found ${blocks.length} testable code blocks in ${filePath}`)
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block === undefined) continue

    const result = await runSingleBlock(block, i, options)
    results.push(result)

    if (!result.success && options.bail) {
      break
    }
  }

  return results
}

/**
 * Run a single code block
 */
async function runSingleBlock(
  block: CodeBlock,
  blockIndex: number,
  options: RunOptions
): Promise<TestResult> {
  const { config, lineNumber, filePath } = block

  // Skip if marked
  if (config.skip === true) {
    return {
      filePath,
      blockIndex,
      lineNumber,
      success: true,
      message: 'Skipped',
    }
  }

  // Typecheck-only mode
  if (config.typecheck === true) {
    return runTypecheckOnly(block, blockIndex)
  }

  // Full runtime test
  return await runRuntimeTest(block, blockIndex, options)
}

/**
 * Run typecheck-only validation
 */
function runTypecheckOnly(block: CodeBlock, blockIndex: number): TestResult {
  // For now, just return success - actual typecheck would require more setup
  // TODO: Implement actual TypeScript compilation check
  return {
    filePath: block.filePath,
    blockIndex,
    lineNumber: block.lineNumber,
    success: true,
    message: 'Typecheck passed (stub)',
  }
}

/**
 * Run full runtime test with emulator
 */
async function runRuntimeTest(
  block: CodeBlock,
  blockIndex: number,
  options: RunOptions
): Promise<TestResult> {
  const { config, code, lineNumber, filePath } = block

  let emulator: ModbusEmulator | undefined

  try {
    // Set up emulator
    emulator = new ModbusEmulator({ transport: 'memory' })

    const slaveId = config.slaveId ?? 1
    emulator.addDevice({
      slaveId,
      registers: {
        holding: config.registers?.holding ?? {},
        input: config.registers?.input ?? {},
      },
    })

    await emulator.start()

    // Create transport for driver
    const memTransport = emulator.getTransport() as unknown as {
      sendRequest(slaveId: number, request: Buffer): Promise<Buffer>
    }
    const transport = createClientTransport(memTransport, slaveId)

    // Capture console.log output
    const capturedLogs: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      const formatted = args.map(formatArg).join(' ')
      capturedLogs.push(formatted)
      if (options.verbose) {
        originalLog('[doctest]', formatted)
      }
    }

    try {
      // Set up globals for the snippet
      const globals: Record<string, unknown> = {
        transport,
      }

      // Import driver's createDriver if specified
      if (config.driver !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const driverModule = await import(config.driver)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        globals['createDriver'] = driverModule.createDriver
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (driverModule.DEFAULT_CONFIG !== undefined) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          globals['DEFAULT_CONFIG'] = driverModule.DEFAULT_CONFIG
        }
      }

      // Execute the snippet
      await executeSnippet(code, globals)

      // Restore console.log
      console.log = originalLog

      // Extract and check expected outputs
      const expectations = extractExpectedOutputs(code)

      if (expectations.length === 0) {
        // No expectations - just verify it runs without error
        return {
          filePath,
          blockIndex,
          lineNumber,
          success: true,
          message: 'Executed successfully (no output assertions)',
        }
      }

      // Check each expected output
      for (let i = 0; i < expectations.length; i++) {
        const expected = expectations[i]
        if (expected === undefined) continue

        const actual = capturedLogs[i]
        if (actual === undefined) {
          return {
            filePath,
            blockIndex,
            lineNumber: expected.lineNumber,
            success: false,
            message: `Missing output at line ${expected.lineNumber}: expected "${expected.expected}"`,
          }
        }

        const result = assertOutput(actual, expected)
        if (!result.pass) {
          return {
            filePath,
            blockIndex,
            lineNumber: expected.lineNumber,
            success: false,
            message: result.message,
          }
        }
      }

      return {
        filePath,
        blockIndex,
        lineNumber,
        success: true,
        message: `Passed (${expectations.length} assertion${expectations.length === 1 ? '' : 's'})`,
      }
    } finally {
      console.log = originalLog
    }
  } catch (error) {
    return {
      filePath,
      blockIndex,
      lineNumber,
      success: false,
      message: error instanceof Error ? error.message : String(error),
      error: error instanceof Error ? error : new Error(String(error)),
    }
  } finally {
    if (emulator !== undefined) {
      await emulator.stop()
    }
  }
}

/**
 * Format an argument for console output comparison
 */
function formatArg(arg: unknown): string {
  if (typeof arg === 'object' && arg !== null) {
    return JSON.stringify(arg)
  }
  return String(arg)
}

/**
 * Execute a code snippet with injected globals
 *
 * Uses Function constructor to dynamically execute code - this is intentional
 * as the whole purpose of doctest is to run documentation examples.
 */
async function executeSnippet(code: string, globals: Record<string, unknown>): Promise<void> {
  // Wrap the code in an async function that has access to globals
  const globalNames = Object.keys(globals)
  const globalValues = Object.values(globals)

  // Build the wrapper function
  const wrappedCode = `
    return (async function(${globalNames.join(', ')}) {
      ${code}
    })(...__globals__)
  `

  // Create and execute the function
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function('__globals__', wrappedCode)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  await fn(globalValues)
}
