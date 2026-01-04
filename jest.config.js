module.exports = {
  projects: [
    '<rootDir>/packages/cli',
    '<rootDir>/packages/device-profiler',
    '<rootDir>/packages/driver-loader',
    '<rootDir>/packages/driver-types',
    '<rootDir>/packages/driver-sdk',
    '<rootDir>/packages/emulator',
    '<rootDir>/packages/mqtt-bridge',
    '<rootDir>/packages/transport',
    '<rootDir>/packages/driver-ex9em',
    '<rootDir>/packages/driver-xymd1',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  maxWorkers: '50%',
}
