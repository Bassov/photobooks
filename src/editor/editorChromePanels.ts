import { PAGE_MAX, PAGE_MIN, pagesOf } from '../core'
import { formatZoomPercent } from './camera'

export { PAGE_MAX, PAGE_MIN, pagesOf }

export interface EditorPanels {
  l: boolean
  b: boolean
  r: boolean
}

/** Kit defaults: all panels open, inspector always mounted (uikit/src/features/parts.tsx:26). */
export const DEFAULT_EDITOR_PANELS: EditorPanels = {
  l: true,
  b: true,
  r: true,
}

export function toggleEditorPanel(
  panels: EditorPanels,
  key: keyof EditorPanels,
): EditorPanels {
  return { ...panels, [key]: !panels[key] }
}

export function toggleAllEditorPanels(panels: EditorPanels): EditorPanels {
  const any = panels.l || panels.b || panels.r
  return { l: !any, b: !any, r: !any }
}

export type PanelHotkey =
  | { kind: 'toggle'; key: keyof EditorPanels }
  | { kind: 'toggle-all' }
  | { kind: 'none' }

/** Map a bare key (no mod/alt) to a panel action when the matching region exists. */
export function panelHotkeyAction(
  key: string,
  regions: { left: boolean; bottom: boolean; right: boolean },
): PanelHotkey {
  if (key === '[' && regions.left) return { kind: 'toggle', key: 'l' }
  if (key === '\\' && regions.bottom) return { kind: 'toggle', key: 'b' }
  if ((key === ']' || key.toLowerCase() === 'i') && regions.right) {
    return { kind: 'toggle', key: 'r' }
  }
  return { kind: 'none' }
}

export function isSpacePanCode(code: string): boolean {
  return code === 'Space'
}

export function isPanelToggleChord(mod: boolean, key: string): boolean {
  if (!mod) return false
  return key === '.'
}

/**
 * Kit list label of spread `i`: `1`, then `2–3`, `4–5`…; with the book's
 * `spreadCount`, a single last page reads its own number (`8`, not `8–9`).
 */
export function pageLabel(i: number, spreadCount?: number): string {
  if (i === 0) return '1'
  if (spreadCount !== undefined && i === spreadCount - 1) return String(i * 2)
  return `${String(i * 2)}–${String(i * 2 + 1)}`
}

/** Kit v7.tsx:208 note under Pages; spreads add 2 pages each. */
export function pagesNote(pages: number): string {
  if (pages < PAGE_MIN) {
    const short = PAGE_MIN - pages
    const spreads = String(Math.ceil(short / 2))
    return `Add ${spreads} spread${short > 2 ? 's' : ''} to reach the ${String(PAGE_MIN)}-page minimum`
  }
  if (pages > PAGE_MAX) {
    const spreads = String(Math.ceil((pages - PAGE_MAX) / 2))
    return `Remove ${spreads} spreads to stay within ${String(PAGE_MAX)} pages`
  }
  return 'Pages are added in spreads of 2'
}

/** Kit v7.tsx:202 Book settings meta line: back text, else front title. */
export function bookSettingsSubtitle(back: string, front: string): string {
  const name = back || front || 'Untitled book'
  return `${name} · applies to the whole book`
}

export function fmtN(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

export function mmToCm(mm: number): number {
  return mm / 10
}

/** "Fit" while the spread fills the pasteboard, else the physical percent. */
export function zoomChromeLabel(zoom: number, fitZoom: number | null): string {
  if (fitZoom !== null && Math.abs(zoom - fitZoom) <= fitZoom * 0.005) {
    return 'Fit'
  }
  return formatZoomPercent(zoom)
}

export function nextZoomOut(zoom: number): number {
  return Math.max(0.25, zoom / 1.25)
}

export function nextZoomIn(zoom: number): number {
  return Math.min(8, zoom * 1.25)
}

export function bookSizeLine(input: {
  widthMm: number
  heightMm: number
  spreads: number
  saveLabel: string | null
}): string {
  const wCm = fmtN(mmToCm(input.widthMm))
  const hCm = fmtN(mmToCm(input.heightMm))
  const pages = String(pagesOf(input.spreads))
  const base = `${wCm} × ${hCm} cm · ${pages} pages`
  return input.saveLabel ? `${base} · ${input.saveLabel}` : base
}
