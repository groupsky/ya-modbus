import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function getPackageInfo(): { version: string; description: string } {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as {
    version: string
    description: string
  }
  return pkg
}
