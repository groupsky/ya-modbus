// Global test setup
// Add custom matchers, global mocks, etc.

// Extend Jest timeout for integration tests
if (process.env.CI) {
  jest.setTimeout(30000)
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Keep error and warn for debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
}
