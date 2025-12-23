module.exports = {
  projects: [
    {
      displayName: 'driver-types',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/driver-types/src/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.base.json',
          },
        ],
      },
      moduleNameMapper: {
        '^@ya-modbus/(.*)$': '<rootDir>/packages/$1/src',
      },
    },
    {
      displayName: 'driver-sdk',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/driver-sdk/src/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.base.json',
          },
        ],
      },
      moduleNameMapper: {
        '^@ya-modbus/(.*)$': '<rootDir>/packages/$1/src',
      },
    },
    {
      displayName: 'ya-modbus-driver-xymd1',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/ya-modbus-driver-xymd1/src/**/*.test.ts'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/tsconfig.base.json',
          },
        ],
      },
      moduleNameMapper: {
        '^@ya-modbus/(.*)$': '<rootDir>/packages/$1/src',
      },
    },
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/*.integration.test.ts',
    '!packages/*/src/**/*.e2e.test.ts',
    '!packages/*/src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  maxWorkers: '50%',
};
