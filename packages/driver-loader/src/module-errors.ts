const NOT_FOUND_CODES = new Set(['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'])

/** Node does not know TypeScript files: too old, or type stripping is off */
const UNKNOWN_TYPESCRIPT = /Unknown file extension "\.[cm]?ts"/

/**
 * What Node could not find (a package name, or the absolute path of a file on POSIX or
 * Windows), and the file that wanted it (not in the CommonJS wording)
 */
const MISSING_TARGET = /Cannot find (?:module|package) '([^']+)'(?: imported from ([^\n]+))?/
const ABSOLUTE_PATH = /^(?:[/\\]|[A-Za-z]:)/
const TYPESCRIPT_FILE = /\.[cm]?tsx?$/

/**
 * Check if an import failed because the package itself is not installed
 *
 * A package that is installed but fails to load (syntax error, missing dependency)
 * is not reported as missing, so the real problem is not hidden by a later candidate.
 * Node names the package in quotes, in both the ESM and the CommonJS wording.
 */
export function isMissingPackageError(error: unknown, packageName: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const { code, message } = error as { code?: unknown; message?: unknown }
  return (
    typeof code === 'string' &&
    NOT_FOUND_CODES.has(code) &&
    typeof message === 'string' &&
    message.includes(`'${packageName}'`)
  )
}

/** Why a driver cannot be loaded as built JavaScript */
export type NotBuiltCause =
  /** A file of the driver is missing, such as the entry file when there is no `dist` directory */
  | 'missing-file'
  /** The driver is TypeScript source and Node does not run it, because it is too old or has type stripping off */
  | 'typescript'
  /** Node strips types, but the TypeScript uses syntax or imports that type stripping cannot run */
  | 'typescript-unsupported'
  /** Node does not run TypeScript from `node_modules` */
  | 'typescript-in-node-modules'

/**
 * Find out if an import failed because the driver is not built
 *
 * A missing file counts when Node names it by its absolute path. A package that is not
 * installed, or a missing dependency, is named by its package name, so neither matches.
 * With `entryPoint` (a local driver) only the entry file itself counts. Another missing
 * file of a built driver is a bug in the driver, which building does not fix, unless
 * TypeScript source asks for it (importing `./x.js` when only `x.ts` exists).
 *
 * @param error - What the import threw
 * @param entryPoint - Absolute path of the entry file, if it is known
 * @returns The cause, or undefined if the error is about something else
 */
export function getNotBuiltCause(error: unknown, entryPoint?: string): NotBuiltCause | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }

  const { code, message } = error as { code?: unknown; message?: unknown }
  if (code === 'ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING') {
    return 'typescript-in-node-modules'
  }
  if (code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX') {
    return 'typescript-unsupported'
  }
  if (typeof code !== 'string' || typeof message !== 'string') {
    return undefined
  }
  if (code === 'ERR_UNKNOWN_FILE_EXTENSION') {
    if (!UNKNOWN_TYPESCRIPT.test(message)) {
      return undefined
    }
    return message.includes('node_modules') ? 'typescript-in-node-modules' : 'typescript'
  }
  if (!NOT_FOUND_CODES.has(code)) {
    return undefined
  }

  const [, missing, importer = ''] = MISSING_TARGET.exec(message) ?? []
  if (missing === undefined || !ABSOLUTE_PATH.test(missing)) {
    return undefined
  }
  if (TYPESCRIPT_FILE.test(importer)) {
    return 'typescript-unsupported'
  }
  return entryPoint === undefined || missing === entryPoint ? 'missing-file' : undefined
}
