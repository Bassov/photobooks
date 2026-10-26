/** Test seam for the no-api Reload CTA. */
export function reloadUnsupportedPage(
  loc: Pick<Location, 'reload'> = window.location,
): void {
  loc.reload()
}
