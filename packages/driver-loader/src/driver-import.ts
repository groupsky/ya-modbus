import { pathToFileURL } from 'node:url'

import type { DriverPackageCandidates } from './driver-name.js'
import { DriverNotBuiltError, DriverNotFoundError } from './errors.js'
import type { SystemDependencies } from './loader.js'
import { getNotBuiltCause, isMissingPackageError, type NotBuiltCause } from './module-errors.js'

type ImportDeps = Pick<SystemDependencies, 'importModule'>

const NOT_BUILT_HINTS: Record<NotBuiltCause, string> = {
  'missing-file': 'Drivers are loaded as built JavaScript. Build the driver first (npm run build).',
  typescript:
    'Drivers are loaded as built JavaScript. Build the driver first (npm run build), ' +
    "or run with Node's built-in type stripping (Node 22.18+ or 24) to load TypeScript source.",
  'typescript-unsupported':
    'Drivers are loaded as built JavaScript. Build the driver first (npm run build). ' +
    "Node's type stripping needs erasable syntax (no enums) and imports that name files with their .ts extension.",
  'typescript-in-node-modules':
    'Node does not run TypeScript from node_modules, so a package must ship built JavaScript.',
}

/**
 * Error for a driver that cannot be loaded because it is not built
 *
 * Shows what Node reported. The "imported from" part is left out when `hideImporter` is set,
 * because then it only names the loader.
 */
function createNotBuiltError(
  packageName: string,
  cause: Error,
  notBuilt: NotBuiltCause,
  hideImporter = false
): DriverNotBuiltError {
  const firstLine = cause.message.replace(/\n[\s\S]*/, '')
  const reason = hideImporter ? firstLine.replace(/ imported from .*$/, '') : firstLine
  return new DriverNotBuiltError(
    `Cannot load driver ${packageName}: ${reason}\n${NOT_BUILT_HINTS[notBuilt]}`,
    packageName,
    { cause }
  )
}

/**
 * Import the first installed package of a list of candidates
 *
 * Moves on to the next candidate only when the package is not installed. A package that
 * is installed but fails to load stops the search, so its error is not replaced by a later one.
 *
 * @param name - Driver name as given by the user
 * @param candidates - Package names to try, in order
 * @param deps - System dependencies
 * @returns The imported module and the name of the package it came from
 * @throws DriverNotBuiltError if the installed package is not built
 * @throws DriverNotFoundError if no candidate is installed or the installed one fails to load
 */
export async function importDriverPackage(
  name: string,
  candidates: DriverPackageCandidates,
  deps: ImportDeps
): Promise<{ packageName: string; driverModule: unknown }> {
  for (const packageName of candidates) {
    try {
      return { packageName, driverModule: await deps.importModule(packageName) }
    } catch (error) {
      const notBuilt = getNotBuiltCause(error)
      if (notBuilt) {
        throw createNotBuiltError(packageName, error as Error, notBuilt)
      }
      if (!isMissingPackageError(error, packageName)) {
        const reason = error instanceof Error ? error.message : String(error)
        throw new DriverNotFoundError(
          `Failed to load driver package ${packageName}: ${reason}`,
          packageName,
          { cause: error }
        )
      }
    }
  }

  const [preferred] = candidates
  const tried = candidates.length > 1 ? `\nTried: ${candidates.join(', ')}` : ''
  throw new DriverNotFoundError(
    `Driver package not found: ${name}${tried}\nInstall it with: npm install ${preferred}`,
    preferred
  )
}

/**
 * Import the entry file of the driver package in the current directory
 *
 * @param packageName - Name from package.json
 * @param entryPoint - Absolute path of the entry file
 * @param deps - System dependencies
 * @returns The imported module
 * @throws DriverNotBuiltError if the entry file is missing or is TypeScript that Node cannot run
 */
export async function importLocalDriver(
  packageName: string,
  entryPoint: string,
  deps: ImportDeps
): Promise<unknown> {
  try {
    return await deps.importModule(pathToFileURL(entryPoint).href)
  } catch (error) {
    const notBuilt = getNotBuiltCause(error, entryPoint)
    if (notBuilt === undefined) {
      throw error
    }
    // The missing entry file is reported as imported by the loader, which is no help
    throw createNotBuiltError(packageName, error as Error, notBuilt, notBuilt === 'missing-file')
  }
}
