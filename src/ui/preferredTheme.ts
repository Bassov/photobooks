export type ProductTheme = 'b' | 'b-dark'

/** Apply Theme B / B-dark from prefers-color-scheme when unset. */
export function applyPreferredTheme(
  root: Pick<HTMLElement, 'dataset'>,
  matchesDark: boolean,
): ProductTheme {
  const current = root.dataset.theme
  if (current === 'b') {
    return 'b'
  }
  if (current === 'b-dark') {
    return 'b-dark'
  }
  if (matchesDark) {
    root.dataset.theme = 'b-dark'
    return 'b-dark'
  }
  root.dataset.theme = 'b'
  return 'b'
}

export function readPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
