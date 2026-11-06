import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    env: { APP_ENV: 'test', MONGODB_DB: 'app_test' },
    testTimeout: 15000,
    hookTimeout: 30000,
  },
})
