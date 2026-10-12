const NOT_FOUND_CODES = new Set(['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'])

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
