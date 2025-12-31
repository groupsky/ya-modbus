import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function getPackageInfo(): { version: string; description: string } {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  // When compiled, this file is at dist/src/utils/package-info.js
  // So we need to go up 3 levels to reach package.json
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf-8')) as {
    version: string
    description: string
  }
  return pkg
}
