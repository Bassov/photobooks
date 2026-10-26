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
    '!src/project/fsa/bookLoad.worker.ts',
    '!src/App.tsx',
    '!src/editor/previewAspect.ts',
    '!src/editor/upgradeSessionAssets.ts',
    '!src/editor/usePasteboardCamera.ts',
    '!src/editor/projectSession.ts',
    '!src/editor/photoRootSession.ts',
    '!src/editor/useChromeImport.tsx',
    '!src/editor/EditorTopBar.tsx',
    '!src/editor/PasteboardEmptyGuidance.tsx',
    // Browser FSA / e2e doubles: high NoCoverage dual-paths; locked by unit + e2e.
    '!src/assets/fsa/handles.ts',
    '!src/assets/scanWalk.ts',
    '!src/photo/directoryHandleFromFiles.ts',
    '!src/project/session/browserSourceRootHandles.ts',
  ],
  ignorePatterns: [
    '.local_dev',
    '.claude',
    '.cursor',
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
