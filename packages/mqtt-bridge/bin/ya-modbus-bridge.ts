#!/usr/bin/env node

/**
 * CLI entry point
 *
 * This file is the executable entry point that parses command-line arguments.
 * The actual CLI implementation is in src/cli.ts
 */

import { program } from '../src/cli.js'

program.parse()
