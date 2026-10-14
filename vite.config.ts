import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  // credentialless: keep Google Fonts loading while enabling crossOriginIsolated.
  'Cross-Origin-Embedder-Policy': 'credentialless',
} as const

export default defineConfig({
  plugins: [
    react({
      compiler: true,
    }),
  ],
  server: {
    headers: { ...isolationHeaders },
  },
  preview: {
    headers: { ...isolationHeaders },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/*.test-helpers.ts',
        'src/**/*.{bench,benchmark}.{ts,tsx}',
        'src/**/*.d.ts',
        'src/main.tsx',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    benchmark: {
      include: ['src/**/*.{bench,benchmark}.{ts,tsx}'],
    },
  },
})
