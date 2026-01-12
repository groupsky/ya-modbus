/**
 * @ya-modbus/doctest - Documentation testing tool
 *
 * Tests code examples in markdown documentation by running them
 * against the Modbus emulator and verifying expected outputs.
 */

export { parseMarkdown, getTestableBlocks, type CodeBlock, type DoctestConfig } from './parser.js'
export { extractExpectedOutputs, assertOutput, type ExpectedOutput } from './extractor.js'
export { runDocTests, type TestResult, type RunOptions } from './runner.js'
export { createClientTransport } from './client-transport.js'
