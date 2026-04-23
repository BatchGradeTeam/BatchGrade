import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['./tests/globalSetup.ts'], // Runs once before & after all tests
    setupFiles: ['./tests/setup.ts'], // Runs before each test file

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      enabled: true,
      // Enforce 79% statement coverage (for now)
      thresholds: { 
        perFile: false, // Will likely hinder development too much if true
        statements: 79,
      },
      // for all source files
      // Note: .sql files are excluded from the coverage report
      // even when explicitly added to the include
      include: [ './src/main/**/*.ts', './src/main/**/**/*.ts'],
      exclude: [ '**index.ts'],
    },

    pool: 'forks',
    forceRerunTriggers: [],
    teardownTimeout: 10000
  },

  resolve: {
    alias: {
      electron: new URL('./tests/__mocks__/electron.ts', import.meta.url).pathname
    }
  },

  server: {
    open: false
  }
})
