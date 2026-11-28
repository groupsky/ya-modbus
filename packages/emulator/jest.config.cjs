module.exports = {
  displayName: 'emulator',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../../tsconfig.base.json',
        useESM: true,
      },
    ],
    // commander 15 is ESM-only; compile it to CommonJS so Jest can load it
    '/node_modules/commander/.+\\.js$': [
      'ts-jest',
      { tsconfig: { allowJs: true, module: 'commonjs' }, diagnostics: false },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!commander/)'],
  moduleNameMapper: {
    '^@ya-modbus/(.*)$': '<rootDir>/../$1/src',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.test.ts',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/cli.ts', // Entry point - tested manually
  ],
  // Loaded by the CLI tests, but still an entry point that is excluded from coverage
  coveragePathIgnorePatterns: ['/node_modules/', '<rootDir>/src/cli.ts'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
}
