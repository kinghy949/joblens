import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['lib/**/__tests__/**/*.test.ts'],
  },
})
