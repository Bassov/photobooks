import { codecovVitePlugin } from '@codecov/vite-plugin'
import react from '@vitejs/plugin-react'
import IstanbulPlugin from 'vite-plugin-istanbul'
import { defineConfig } from 'vitest/config'
import { loadGates } from './scripts/load-gates.mjs'
import { uikitDevMiddleware } from './scripts/vite-uikit-middleware.mjs'

const gates = loadGates()

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  // credentialless: keep Google Fonts loading while enabling crossOriginIsolated.
  'Cross-Origin-Embedder-Policy': 'credentialless',
} as const

const codecovToken = process.env.CODECOV_TOKEN
const withE2eCoverage = process.env.VITE_COVERAGE === '1'

/** Shared Vitest + Istanbul exclude globs (tests, benches, decls, helpers, bootstrap). */
export const coverageExcludeGlobs = [
  'src/**/*.{test,spec}.{ts,tsx}',
  'src/**/*.test-helpers.ts',
  'src/**/*.{bench,benchmark}.{ts,tsx}',
  'src/**/*.d.ts',
  'src/main.tsx',
] as const

/** E2e Istanbul additionally skips workers (unit coverage still includes them). */
const e2eIstanbulExcludeGlobs = [
  ...coverageExcludeGlobs,
  'src/**/*.worker.ts',
] as const

export default defineConfig({
  plugins: [
    react({
      compiler: true,
    }),
    uikitDevMiddleware(),
    codecovVitePlugin({
      enableBundleAnalysis: Boolean(codecovToken),
      bundleName: 'photobooks',
      ...(codecovToken ? { uploadToken: codecovToken } : {}),
      gitService: 'github',
      telemetry: false,
    }),
    ...(withE2eCoverage
      ? [
          IstanbulPlugin({
            include: 'src/**/*',
            exclude: [...e2eIstanbulExcludeGlobs],
            extension: ['.js', '.ts', '.tsx'],
            requireEnv: false,
            forceBuildInstrument: true,
          }),
        ]
      : []),
  ],
  ...(withE2eCoverage ? { build: { sourcemap: true as const } } : {}),
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
    allowOnly: false,
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
        'scripts/check.mjs',
        'scripts/e2e-burn-in-count.mjs',
        'scripts/e2e-burn-in-targets.mjs',
        'scripts/e2e-changed-quiet.mjs',
        'scripts/e2e-playwright-summary.mjs',
        'scripts/load-gates.mjs',
        'scripts/check-gate-values.mjs',
        'scripts/check-gate-ratchet.mjs',
        'scripts/check-test-weakening.mjs',
        'scripts/check-codecov-yml.mjs',
        'scripts/e2e-flaky-list.mjs',
      ],
      exclude: [...coverageExcludeGlobs],
      thresholds: gates.coverage,
    },
    benchmark: {
      include: ['src/**/*.{bench,benchmark}.{ts,tsx}'],
    },
  },
})
