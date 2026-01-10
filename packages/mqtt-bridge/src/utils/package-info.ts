import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Use __dirname which works in CommonJS and is available in Node.js
// In ESM builds, TypeScript will error but the CJS build will work
// This is acceptable for dual builds
declare const __dirname: string

export function getPackageInfo(): { version: string; description: string } {
  // When compiled, this file is at dist/{esm|cjs}/utils/package-info.js
  // So we need to go up 3 levels to reach package.json
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf-8')) as {
    version: string
    description: string
  }
  return pkg
}
