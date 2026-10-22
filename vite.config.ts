import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serve o site em https://<user>.github.io/house-shopping/
  base: '/house-shopping/',
  plugins: [preact()],
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
