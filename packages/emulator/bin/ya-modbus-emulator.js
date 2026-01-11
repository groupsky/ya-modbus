#!/usr/bin/env node

// Entry point for CLI - delegates to compiled TypeScript
import { main } from '../dist/esm/cli.js'

// Run the CLI
main().catch((error) => {
  console.error('[ERROR]', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
