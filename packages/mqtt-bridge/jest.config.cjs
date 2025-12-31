module.exports = {
  displayName: '@ya-modbus/mqtt-bridge',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../../tsconfig.base.json',
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    '^@ya-modbus/(.*)$': '<rootDir>/../$1/src',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^chalk$': '<rootDir>/src/__mocks__/chalk.ts',
  },
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '<rootDir>/bin/**/*.ts',
    '!<rootDir>/src/**/*.test.ts',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/__mocks__/**/*.ts',
    '!<rootDir>/src/package-info.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/cli.ts': {
      branches: 75,
      functions: 25,
      lines: 70,
      statements: 65,
    },
  },
}
