import { defineConfig } from 'vitest/config'

// Routine tests: no network, no browser. A test that needs a DOM says so with `// @vitest-environment jsdom`.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
