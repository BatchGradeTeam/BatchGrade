import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['./tests/globalSetup.ts'], // TODO: comment out process.exit(0)
    setupFiles: ['./tests/setup.ts'], // TODO: update for all src files
    include: ['tests/**/*.test.ts'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Although the threshold creates errors for inadequate
      // coverage, globalSetup.ts makes it so that npm run test
      // returns exit code 0 even when test coverage fails
      thresholds: {
        perFile: true,
        statements: 90
      },
      exclude: [
        'src/main/database/schema/index.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/out/**',
        '**/coverage/**'
      ]
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
