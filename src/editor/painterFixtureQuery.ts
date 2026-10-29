export function isPainterFixtureQuery(
  search = window.location.search,
): boolean {
  // Literal `import.meta.env` check: Rollup folds it, so the deploy build
  // drops every `?fixture=painter` branch.
  if (!(import.meta.env.DEV || import.meta.env.VITE_TEST_FIXTURES === '1')) {
    return false
  }
  return new URLSearchParams(search).get('fixture') === 'painter'
}
