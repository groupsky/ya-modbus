import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import ownPackageJson from '../package.json'

import { findCallerFile, getCallerPackageInfo, readPackageInfo } from './package-info.js'

describe('getCallerPackageInfo', () => {
  test('returns the package info of the module that calls it', () => {
    expect(getCallerPackageInfo()).toEqual({
      version: ownPackageJson.version,
      description: ownPackageJson.description,
    })
  })

  test('still finds the caller when the application lowered the stack trace limit', () => {
    const originalLimit = Error.stackTraceLimit
    Error.stackTraceLimit = 0
    try {
      expect(getCallerPackageInfo().version).toBe(ownPackageJson.version)
      expect(Error.stackTraceLimit).toBe(0)
    } finally {
      Error.stackTraceLimit = originalLimit
    }
  })

  test('restores the previous stack trace formatter', () => {
    const originalPrepare = Error.prepareStackTrace
    const customPrepare = (): string => 'custom'
    Error.prepareStackTrace = customPrepare
    try {
      getCallerPackageInfo()
      expect(Error.prepareStackTrace).toBe(customPrepare)
    } finally {
      Error.prepareStackTrace = originalPrepare
    }
  })
})

describe('findCallerFile', () => {
  test.each([
    {
      name: 'a path',
      files: ['/lib/package-info.js', '/app/cli.js', '/app/other.js'],
      expected: '/app/cli.js',
    },
    {
      name: 'a file URL',
      files: ['file:///lib/package-info.js', 'file:///app/cli.js'],
      expected: 'file:///app/cli.js',
    },
    {
      name: 'the first frame from another file, past frames of this module',
      files: ['/lib/package-info.js', '/lib/package-info.js', '/app/cli.js'],
      expected: '/app/cli.js',
    },
    {
      name: 'frames without a file name or a real path skipped',
      files: ['/lib/package-info.js', undefined, 'node:internal/timers', '/app/cli.js'],
      expected: '/app/cli.js',
    },
  ])('returns $name', ({ files, expected }) => {
    expect(findCallerFile(files)).toBe(expected)
  })

  test('throws when no frame is a calling module', () => {
    expect(() =>
      findCallerFile(['/lib/package-info.js', undefined, 'node:internal/timers'])
    ).toThrow('Cannot determine the calling module')
  })
})

describe('readPackageInfo', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'package-info-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function writePackageJson(dir: string, content: object): void {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify(content))
  }

  test('reads the package.json above the given file', () => {
    writePackageJson(root, { name: 'pkg', version: '1.2.3', description: 'A package' })

    expect(readPackageInfo(join(root, 'src', 'cli.js'))).toEqual({
      version: '1.2.3',
      description: 'A package',
    })
  })

  test('skips package.json files without a version, such as the module type markers in dist', () => {
    writePackageJson(root, { name: 'pkg', version: '1.2.3', description: 'A package' })
    writePackageJson(join(root, 'dist', 'esm'), { type: 'module' })
    writePackageJson(join(root, 'dist', 'cjs'), { type: 'commonjs' })

    expect(readPackageInfo(join(root, 'dist', 'esm', 'src', 'cli.js')).version).toBe('1.2.3')
    expect(readPackageInfo(join(root, 'dist', 'cjs', 'src', 'cli.js')).version).toBe('1.2.3')
  })

  test('accepts a file URL, as reported for ES modules', () => {
    writePackageJson(root, { name: 'pkg', version: '1.2.3', description: 'A package' })

    const fileUrl = pathToFileURL(join(root, 'dist', 'esm', 'src', 'cli.js')).href

    expect(readPackageInfo(fileUrl).version).toBe('1.2.3')
  })

  test('uses an empty description when the package has none', () => {
    writePackageJson(root, { name: 'pkg', version: '1.2.3' })

    expect(readPackageInfo(join(root, 'cli.js'))).toEqual({ version: '1.2.3', description: '' })
  })

  test('throws when no package.json with a version is found', () => {
    // A reader that finds no file anywhere, so the result does not depend on this machine
    const readNothing = (): string => {
      throw new Error('ENOENT')
    }
    const file = join(root, 'src', 'cli.js')

    expect(() => readPackageInfo(file, readNothing)).toThrow(
      `No package.json with a version found for ${file}`
    )
  })
})
