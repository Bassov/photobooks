/**
 * Compile-time switch for e2e-only seams (folder-input double, in-memory
 * source-root handles). Vite replaces `import.meta.env` statically, so the
 * deploy build (no `VITE_TEST_FIXTURES`) drops every branch guarded by it.
 * There is no runtime switch. `?fixture=painter`, `?testLibrary` and
 * `window.__photobooks*` check `import.meta.env` literally at their call
 * sites (`DEV || VITE_TEST_FIXTURES`) so Rollup folds them before chunking.
 */
export const TEST_FIXTURES_FLAG: boolean =
  import.meta.env.VITE_TEST_FIXTURES === '1'
