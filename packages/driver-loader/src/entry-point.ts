/**
 * Conditions Node uses for `import()` when it resolves package `exports`.
 * Other runtimes use other conditions (for example `deno` or `bun`).
 */
export const IMPORT_CONDITIONS: readonly string[] = ['node', 'import', 'module-sync', 'default']

/** The package.json fields that decide where a package is entered */
export interface PackageEntryFields {
  main?: unknown
  exports?: unknown
}

/**
 * Resolve a conditional `exports` target to a file path
 *
 * Follows the Node rules: the first key that matches a condition and leads somewhere wins.
 * A `null` condition blocks the path, so the search stops there. In an array, a `null`
 * result is skipped and the next item is tried.
 */
function resolveTarget(target: unknown, conditions: readonly string[]): string | null | undefined {
  if (target === null) {
    return null
  }

  if (typeof target === 'string') {
    return target.startsWith('./') ? target : undefined
  }

  if (Array.isArray(target)) {
    for (const item of target as unknown[]) {
      const resolved = resolveTarget(item, conditions)
      if (typeof resolved === 'string') {
        return resolved
      }
    }
    return undefined
  }

  if (typeof target === 'object') {
    for (const [condition, value] of Object.entries(target as Record<string, unknown>)) {
      const resolved = conditions.includes(condition) ? resolveTarget(value, conditions) : undefined
      if (resolved !== undefined) {
        return resolved
      }
    }
  }

  return undefined
}

/**
 * Find the file that `import('<package>')` loads, from a package.json
 *
 * Uses `exports["."]` when the package has `exports`, otherwise `main`, otherwise `index.js`,
 * like Node does. Paths are relative to the package directory.
 *
 * @returns The relative path, or undefined if `exports` has no entry for these conditions
 */
export function resolvePackageEntry(
  packageJson: PackageEntryFields,
  conditions: readonly string[] = IMPORT_CONDITIONS
): string | undefined {
  // Not destructured as `exports`: in the CommonJS build that would shadow the module's own exports
  const { main, exports: exportsField } = packageJson

  if (exportsField === undefined || exportsField === null) {
    return typeof main === 'string' ? main : 'index.js'
  }

  // `exports` is either a map of subpaths ("." and "./x") or the target of "." itself
  const isSubpathMap =
    typeof exportsField === 'object' &&
    !Array.isArray(exportsField) &&
    Object.keys(exportsField).some((key) => key.startsWith('.'))

  return (
    resolveTarget(
      isSubpathMap ? (exportsField as Record<string, unknown>)['.'] : exportsField,
      conditions
    ) ?? undefined
  )
}
