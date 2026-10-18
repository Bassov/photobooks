import { codecovVitePlugin } from '@codecov/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  // credentialless: keep Google Fonts loading while enabling crossOriginIsolated.
  'Cross-Origin-Embedder-Policy': 'credentialless',
} as const

const codecovToken = process.env.CODECOV_TOKEN

export default defineConfig({
  plugins: [
    react({
      compiler: true,
    }),
    codecovVitePlugin({
      enableBundleAnalysis: Boolean(codecovToken),
      bundleName: 'photobooks',
      ...(codecovToken ? { uploadToken: codecovToken } : {}),
      gitService: 'github',
      telemetry: false,
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
    setupFiles: ['./scripts/vitest.setup.mjs'],
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.test.mjs'],
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'reports/vitest-junit.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: [
        'src/**/*.{ts,tsx}',
        'scripts/roadmap.mjs',
        'scripts/agent.mjs',
        'scripts/e2e-burn-in-count.mjs',
        'scripts/e2e-burn-in-targets.mjs',
        'scripts/e2e-changed-quiet.mjs',
        'scripts/e2e-playwright-summary.mjs',
      ],
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
