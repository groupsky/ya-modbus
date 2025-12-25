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
  },
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
    '!<rootDir>/src/index.ts', // CLI entry point - tested via integration tests
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
