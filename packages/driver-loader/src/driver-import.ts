import type { DriverPackageCandidates } from './driver-name.js'
import { DriverNotFoundError } from './errors.js'
import type { SystemDependencies } from './loader.js'
import { isMissingPackageError } from './module-errors.js'

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
 * @throws DriverNotFoundError if no candidate is installed or the installed one fails to load
 */
export async function importDriverPackage(
  name: string,
  candidates: DriverPackageCandidates,
  deps: Pick<SystemDependencies, 'importModule'>
): Promise<{ packageName: string; driverModule: unknown }> {
  for (const packageName of candidates) {
    try {
      return { packageName, driverModule: await deps.importModule(packageName) }
    } catch (error) {
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
