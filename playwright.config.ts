import { defineConfig, devices } from '@playwright/test'

const PORT = 4321

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/house-shopping/`,
    trace: 'retain-on-failure',
  },
  // Celular primeiro: a maioria dos acessos vem de links no WhatsApp.
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/house-shopping/`,
    reuseExistingServer: !process.env.CI,
    // Encurtador falso: nos testes nada sai para a internet (share.spec simula as respostas).
    env: { VITE_SHORTENER: 'https://encurtador.test/criar?url=' },
  },
})
