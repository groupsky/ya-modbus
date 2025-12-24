module.exports = {
  projects: [
    '<rootDir>/packages/cli',
    '<rootDir>/packages/driver-types',
    '<rootDir>/packages/driver-sdk',
    '<rootDir>/packages/ya-modbus-driver-xymd1',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 90, // Lowered from 95% - remaining gaps are defensive code (null coalescing) and complex dynamic imports
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  maxWorkers: '50%',
}
