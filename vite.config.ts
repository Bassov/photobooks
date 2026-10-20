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

/** Shared Vitest + Istanbul exclude globs (tests, benches, decls, helpers, bootstrap, thin CLIs). */
export const coverageExcludeGlobs = [
  'src/**/*.{test,spec}.{ts,tsx}',
  'src/**/*.test-helpers.ts',
  'src/**/*.{bench,benchmark}.{ts,tsx}',
  'src/**/*.d.ts',
  'src/main.tsx',
  'scripts/**/*.test.mjs',
  'scripts/agent-cli.mjs',
  'scripts/codecov-yml-cli.mjs',
  'scripts/e2e-burn-in-count-cli.mjs',
  'scripts/e2e-burn-in-targets-cli.mjs',
  'scripts/e2e-changed-quiet-cli.mjs',
  'scripts/e2e-playwright-summary-cli.mjs',
  'scripts/gate-ratchet-cli.mjs',
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
      include: ['src/**/*.{ts,tsx}', 'scripts/**/*.mjs'],
      exclude: [...coverageExcludeGlobs],
      thresholds: {
        statements: gates.coverage.statements,
        branches: gates.coverage.branches,
        functions: gates.coverage.functions,
        lines: gates.coverage.lines,
      },
    },
    benchmark: {
      include: ['src/**/*.{bench,benchmark}.{ts,tsx}'],
    },
  },
})
