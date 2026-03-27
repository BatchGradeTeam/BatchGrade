import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      enabled: true,
      thresholds: {
        perFile: true,
        statements: 90,
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
    forceReRunTriggers: [],
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