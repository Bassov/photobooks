import { loadGates } from '@albasov/ts-agent-rig/load-gates'

const gates = loadGates()

const config = {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: {
    configFile: 'vite.config.ts',
    related: true,
  },
  mutate: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.{test,spec}.{ts,tsx}',
    '!src/**/*.{bench,benchmark}.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test-helpers.ts',
    '!src/core/testing/**',
    '!src/photo/photo.worker.ts',
    '!src/assets/hash.worker.ts',
    '!src/project/fsa/bookLoad.worker.ts',
    '!src/editor/previewAspect.ts',
    '!src/editor/upgradeSessionAssets.ts',
    '!src/editor/usePasteboardCamera.ts',
    '!src/editor/projectSession.ts',
  ],
  ignorePatterns: [
    '.local_dev',
    'dist',
    'coverage',
    'reports',
    'test-results',
    'playwright-report',
    '.lighthouseci',
    '.stryker-tmp',
    'C:*',
  ],
  reporters: ['clear-text', 'html', 'json'],
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
  mutator: {
    excludedMutations: ['StringLiteral'],
  },
  coverageAnalysis: 'perTest',
  thresholds: gates.stryker.thresholds,
  ignoreStatic: true,
}

export default config
