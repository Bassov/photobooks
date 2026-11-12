import { codecovVitePlugin } from '@codecov/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import IstanbulPlugin from 'vite-plugin-istanbul'
import { defineConfig } from 'vitest/config'
import { loadGates } from '@albasov/ts-agent-rig/load-gates'
import { siteViewerManifestPlugin } from './scripts/vite-site-viewer-manifest.mjs'
import { uikitDevMiddleware } from './scripts/vite-uikit-middleware.mjs'

const gates = loadGates()

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  // credentialless: crossOriginIsolated for workers/OPFS without requiring CORP on all assets.
  'Cross-Origin-Embedder-Policy': 'credentialless',
} as const

const codecovToken = process.env.CODECOV_TOKEN
const withE2eCoverage = process.env.VITE_COVERAGE === '1'
const withTestFixtures = process.env.VITE_TEST_FIXTURES === '1'

/** Shared Vitest + Istanbul exclude globs (tests, benches, decls, helpers, bootstrap, thin CLIs). */
export const coverageExcludeGlobs = [
  'src/**/*.{test,spec}.{ts,tsx}',
  'src/**/*.test-helpers.ts',
  'src/**/*.{bench,benchmark}.{ts,tsx}',
  'src/**/*.d.ts',
  'scripts/**/*.test.mjs',
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
    tailwindcss(),
    uikitDevMiddleware(),
    // Export site copies the `site` entry's files listed here into dist/viewer/.
    siteViewerManifestPlugin('site'),
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
  worker: {
    // The site export worker prerenders with components that import CSS;
    // a worker has no `document` to inject it into, and the pages link
    // their own stylesheet, so CSS imports become empty modules there.
    plugins: () => [
      {
        name: 'photobooks-worker-no-css',
        enforce: 'pre' as const,
        resolveId(id: string) {
          return /\.css(\?|$)/.test(id) ? '\0worker-no-css' : null
        },
        load(id: string) {
          return id === '\0worker-no-css' ? 'export default ""' : null
        },
      },
    ],
  },
  build: {
    // Second entry: the static site viewer (prerendered pages hydrate it).
    // The derivative lab is dev-only: test builds (e2e) add it, deploy never.
    rolldownOptions: {
      input: {
        main: 'index.html',
        site: 'site.html',
        ...(withTestFixtures ? { lab: 'dev/derivative-lab.html' } : {}),
      },
    },
    ...(withE2eCoverage ? { sourcemap: true as const } : {}),
  },
  experimental: {
    // Lazy chunks (the site home's GL books) and their preload deps resolve
    // from the importing chunk, so an exported site finds them under viewer/.
    renderBuiltUrl: (_file: string, { hostType }: { hostType: string }) =>
      hostType === 'js' ? { relative: true } : undefined,
  },
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
