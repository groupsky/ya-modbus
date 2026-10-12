import { extname, join } from 'node:path'

import { resolvePackageEntry, type PackageEntryFields } from './entry-point.js'
import { PackageJsonError } from './errors.js'
import type { SystemDependencies } from './loader.js'

/**
 * A driver package found in the current directory
 */
export interface LocalPackage {
  /** Name from package.json */
  name: string
  /** Absolute path of the file that importing the package loads */
  entryPoint: string
}

/**
 * Auto-detect local driver package from package.json
 *
 * @param deps - System dependencies
 * @returns Package name and entry file if valid driver package
 * @throws Error if not a valid driver package
 */
export async function detectLocalPackage(
  deps: Pick<SystemDependencies, 'getCwd' | 'readFile'>
): Promise<LocalPackage> {
  try {
    const cwd = deps.getCwd()
    const packageJsonContent = await deps.readFile(join(cwd, 'package.json'), 'utf-8')
    const packageJson = JSON.parse(packageJsonContent) as PackageEntryFields & {
      name?: string
      keywords?: string[]
    }

    const keywords = packageJson.keywords ?? []
    if (!keywords.includes('ya-modbus-driver')) {
      throw new PackageJsonError(
        'Current package is not a ya-modbus driver. ' +
          'Add "ya-modbus-driver" to keywords in package.json'
      )
    }

    const name = packageJson.name
    if (!name) {
      throw new PackageJsonError('package.json must have a "name" field')
    }

    const entry = resolvePackageEntry(packageJson)
    if (entry === undefined) {
      throw new PackageJsonError(
        'package.json "exports" has no entry for "." that can be imported. ' +
          'Add an "import" or "default" condition to exports["."]'
      )
    }

    if (extname(entry) === '') {
      throw new PackageJsonError(
        `The entry point "${entry}" in package.json has no file extension. ` +
          'Name the built file, for example "./dist/index.js"'
      )
    }

    return { name, entryPoint: join(cwd, entry) }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new PackageJsonError(
        'package.json not found in current directory. ' +
          'Run this command from a driver package directory or specify --driver'
      )
    }
    if (error instanceof SyntaxError) {
      throw new PackageJsonError('Failed to parse package.json: invalid JSON')
    }
    throw error
  }
}
