export function isPainterFixtureQuery(
  search = window.location.search,
): boolean {
  return new URLSearchParams(search).get('fixture') === 'painter'
}
