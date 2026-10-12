import { resolvePackageEntry } from './entry-point.js'

describe('resolvePackageEntry', () => {
  test.each([
    ['no main and no exports', {}, 'index.js'],
    ['main', { main: 'dist/index.js' }, 'dist/index.js'],
    ['a main that is not a string', { main: 5 }, 'index.js'],
    ['exports set to null', { main: 'lib/main.js', exports: null }, 'lib/main.js'],
    ['exports as a string', { exports: './dist/index.js' }, './dist/index.js'],
    ['exports as an array', { exports: ['./a.js', './b.js'] }, './a.js'],
    [
      'exports as a subpath map',
      { exports: { '.': './dist/index.js', './other': './dist/other.js' } },
      './dist/index.js',
    ],
    [
      'exports as conditions without a subpath',
      { exports: { import: './esm.js', require: './cjs.js' } },
      './esm.js',
    ],
    [
      'nested conditions of a dual package',
      {
        main: './dist/cjs/index.js',
        exports: {
          '.': {
            import: { types: './dist/esm/index.d.ts', default: './dist/esm/index.js' },
            require: { types: './dist/cjs/index.d.ts', default: './dist/cjs/index.js' },
          },
        },
      },
      './dist/esm/index.js',
    ],
    [
      'the types condition is not used',
      { exports: { types: './x.d.ts', default: './x.js' } },
      './x.js',
    ],
    [
      'the module-sync condition',
      { exports: { 'module-sync': './sync.js', default: './other.js' } },
      './sync.js',
    ],
    ['an array with a null before the target', { exports: [null, './ok.js'] }, './ok.js'],
    [
      'an array with a blocked condition before the target',
      { exports: [{ node: null }, './ok.js'] },
      './ok.js',
    ],
    ['the node condition', { exports: { node: './node.js', default: './other.js' } }, './node.js'],
    [
      'the first matching condition in object order',
      { exports: { default: './default.js', import: './import.js' } },
      './default.js',
    ],
    [
      'a condition that leads nowhere is skipped',
      { exports: { import: { require: './cjs.js' }, default: './fallback.js' } },
      './fallback.js',
    ],
    [
      'an array with an unusable first target',
      { exports: ['not-relative.js', './ok.js'] },
      './ok.js',
    ],
  ])('resolves %s', (_description, packageJson, expected) => {
    expect(resolvePackageEntry(packageJson)).toBe(expected)
  })

  test.each([
    ['only a require condition', { exports: { '.': { require: './cjs.js' } } }],
    ['exports without an entry for "."', { exports: { './other': './other.js' } }],
    ['exports that hide main', { main: './index.js', exports: { require: './index.js' } }],
    ['a target outside the package', { exports: '../outside.js' }],
    ['a target that is not relative', { exports: 'dist/index.js' }],
    ['a null target', { exports: { '.': null } }],
    ['a condition set to null', { exports: { import: null, default: './fallback.js' } }],
    ['a target that is not text', { exports: { '.': 42 } }],
    ['an array without a usable target', { exports: ['dist/index.js', null] }],
  ])('finds no entry for %s', (_description, packageJson) => {
    expect(resolvePackageEntry(packageJson)).toBeUndefined()
  })

  test('uses the conditions it is given', () => {
    const packageJson = { exports: { deno: './deno.js', import: './node.js', default: './x.js' } }

    expect(resolvePackageEntry(packageJson, ['deno', 'default'])).toBe('./deno.js')
    expect(resolvePackageEntry(packageJson)).toBe('./node.js')
  })
})
