module.exports = {
  displayName: '@ya-modbus/cli',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../../tsconfig.base.json',
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
    // Map workspace package imports to their source directories for testing
    '^@ya-modbus/(.*)$': '<rootDir>/../$1/src',
    // Strip .js extensions from relative imports (ESM compatibility)
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Mock chalk to avoid terminal formatting in test output
    '^chalk$': '<rootDir>/src/__mocks__/chalk.ts',
    // Mock cli-table3 to simplify table output assertions
    '^cli-table3$': '<rootDir>/src/__mocks__/cli-table3.ts',
  },
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.test.ts',
    '!<rootDir>/src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
}
