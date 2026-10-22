import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serve o site em https://<user>.github.io/house-shopping/
  base: '/house-shopping/',
  plugins: [preact()],
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      include: ['src/engine/**', 'src/data/**'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
})
