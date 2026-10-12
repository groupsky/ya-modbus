#!/usr/bin/env node

// Runs the executable of @ya-modbus/cli so that `npx ya-modbus` works.
// The target only exposes "." through its exports map, so locate the executable relative to
// the main entry (dist/cjs/src/index.js), following the dist layout all packages share.
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const entry = createRequire(import.meta.url).resolve('@ya-modbus/cli')
await import(pathToFileURL(join(dirname(entry), '../../esm/bin/ya-modbus.js')).href)
