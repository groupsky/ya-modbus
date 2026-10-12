import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface PackageInfo {
  version: string
  description: string
}

const MIN_STACK_TRACE_LIMIT = 10

/**
 * Call sites of the current stack, innermost first.
 *
 * V8 formats `stack` lazily, so it must be read while the formatter is replaced.
 */
function getCallSites(): NodeJS.CallSite[] {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- only restored, never called
  const originalPrepare = Error.prepareStackTrace
  const originalLimit = Error.stackTraceLimit
  try {
    Error.prepareStackTrace = (_error, callSites) => callSites
    // An application can lower the limit so far that the caller is not on the stack
    Error.stackTraceLimit = Math.max(originalLimit, MIN_STACK_TRACE_LIMIT)
    return new Error().stack as unknown as NodeJS.CallSite[]
  } finally {
    Error.prepareStackTrace = originalPrepare
    Error.stackTraceLimit = originalLimit
  }
}

type ReadTextFile = (path: string) => string

const readUtf8File: ReadTextFile = (path) => readFileSync(path, 'utf-8')

function readPackageJson(
  path: string,
  readFile: ReadTextFile
): Partial<Record<keyof PackageInfo, unknown>> | undefined {
  let content: string
  try {
    content = readFile(path)
  } catch {
    return undefined
  }
  return JSON.parse(content) as Partial<Record<keyof PackageInfo, unknown>>
}

/**
 * Read the version and description from the closest package.json above a file
 *
 * package.json files without a version are skipped. This passes over the
 * `{"type": "module"}` and `{"type": "commonjs"}` markers in `dist/esm` and `dist/cjs`.
 *
 * @param file - Path or `file:` URL of a module inside the package
 * @param readFile - Reads a file as text and throws if it does not exist (replaceable in tests)
 * @throws Error if no package.json with a version is found
 */
export function readPackageInfo(file: string, readFile: ReadTextFile = readUtf8File): PackageInfo {
  const path = file.startsWith('file:') ? fileURLToPath(file) : file

  for (let dir = dirname(path); ; dir = dirname(dir)) {
    const packageJson = readPackageJson(join(dir, 'package.json'), readFile)
    if (typeof packageJson?.version === 'string') {
      return {
        version: packageJson.version,
        description: typeof packageJson.description === 'string' ? packageJson.description : '',
      }
    }
    if (dirname(dir) === dir) {
      throw new Error(`No package.json with a version found for ${path}`)
    }
  }
}

/**
 * Pick the calling module from the file names of a stack, innermost first
 *
 * The first frame is this module. The caller is the first frame from another file that is a
 * real module path or `file:` URL, which skips frames such as `node:internal/timers`.
 *
 * @throws Error if the stack has no such frame
 */
export function findCallerFile(files: ReadonlyArray<string | undefined>): string {
  const [ownFile] = files
  const callerFile = files.find(
    (file) =>
      file !== undefined && file !== ownFile && (file.startsWith('file:') || isAbsolute(file))
  )

  if (callerFile === undefined) {
    throw new Error('Cannot determine the calling module')
  }

  return callerFile
}

/**
 * Get the version and description of the package that contains the calling module
 *
 * Lets a CLI report its own package.json values without hardcoding them. The caller's
 * location comes from the call stack, so it works the same in ES module and CommonJS
 * builds, where `import.meta.url` and `__dirname` are each available in only one.
 *
 * @example
 * ```typescript
 * const { version } = getCallerPackageInfo()
 * program.version(version)
 * ```
 *
 * @throws Error if the calling module cannot be determined or has no package.json with a version
 */
export function getCallerPackageInfo(): PackageInfo {
  const files = getCallSites().map((callSite) => callSite.getFileName() ?? undefined)

  return readPackageInfo(findCallerFile(files))
}
