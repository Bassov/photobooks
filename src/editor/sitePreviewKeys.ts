export interface KeyMods {
  alt: boolean
  ctrl: boolean
  meta: boolean
  shift: boolean
}

/** What a key does in the site preview; `null`: nothing (still swallowed). */
export type SitePreviewAction =
  | { kind: 'close' }
  | { kind: 'tab'; back: boolean }
  | { kind: 'slide'; slide: number }
  | null

/**
 * Site preview keys over slides `0..n` (cover + `n` spreads): Esc closes, Tab
 * stays trapped, ←/→ step and Home/End jump (clamped) without Alt/Ctrl/Meta.
 */
export function sitePreviewKey(
  key: string,
  mods: KeyMods,
  slide: number,
  n: number,
): SitePreviewAction {
  if (key === 'Escape') return { kind: 'close' }
  if (key === 'Tab') return { kind: 'tab', back: mods.shift }
  if (mods.alt || mods.ctrl || mods.meta) return null
  const next = {
    ArrowLeft: slide - 1,
    ArrowRight: slide + 1,
    Home: 0,
    End: n,
  }[key]
  if (next === undefined) return null
  return { kind: 'slide', slide: Math.max(0, Math.min(n, next)) }
}
