import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function getPackageInfo(): { version: string; description: string } {
  // Determine the package root differently for ESM vs CJS builds
  // In CJS: __dirname is available
  // In ESM: use import.meta.url

  let pkgPath: string

  // Check if we're in a CommonJS context by testing for __dirname
  // This works because typeof __dirname is 'undefined' in ESM but 'string' in CJS
  if (typeof __dirname !== 'undefined') {
    // CommonJS: file is at dist/cjs/src/utils/package-info.js
    pkgPath = join(__dirname, '../../../../package.json')
  } else {
    // ESM: file is at dist/esm/src/utils/package-info.js
    // Use import.meta.url (only executed in ESM builds where it's valid)
    // TypeScript will complain about import.meta in CJS, but this branch is never reached in CJS runtime
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - import.meta is valid in ESM but TypeScript CJS build sees all code
    const currentFileUrl = new URL(import.meta.url)
    pkgPath = fileURLToPath(new URL('../../../../package.json', currentFileUrl))
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
    version: string
    description: string
  }
  return pkg
}
