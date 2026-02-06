#!/usr/bin/env node

/**
 * CLI entry point for Modbus emulator
 *
 * This file is the executable entry point for the emulator CLI.
 * The actual CLI implementation is in src/cli.ts
 */

import { main } from '../src/cli.js'

// Run the CLI
main().catch((error) => {
  console.error('[ERROR]', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
