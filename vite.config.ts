import preact from '@preact/preset-vite'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// GitHub Pages serve o site em https://<user>.github.io/house-shopping/
const BASE = '/house-shopping/'

/** Em dev, /house-shopping (sem a barra) vai para /house-shopping/, como no GitHub Pages. */
const redirectToBase = (): Plugin => ({
  name: 'redirect-to-base',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== BASE.slice(0, -1) && req.url !== '/') return next()
      res.writeHead(302, { Location: BASE }).end()
    })
  },
})

// https://vite.dev/config/
export default defineConfig({
  base: BASE,
  plugins: [preact(), redirectToBase()],
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      include: ['src/engine/**', 'src/data/**'],
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
})
