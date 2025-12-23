module.exports = {
  projects: [
    '<rootDir>/packages/driver-types',
    '<rootDir>/packages/driver-sdk',
    '<rootDir>/packages/ya-modbus-driver-xymd1',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
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
}
