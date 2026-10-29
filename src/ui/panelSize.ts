export const PANEL_MIN = 150
export const PANEL_MAX = 360
const PANEL_STEP = 8
const PANEL_STEP_LARGE = PANEL_STEP * 4

export type PanelSide = 'left' | 'right'

export const PANEL_DEFAULTS: Record<PanelSide, number> = {
  left: 188,
  right: 264,
}

const STORAGE_PREFIX = 'photobooks.panel.'

export function clampPanelWidth(width: number): number {
  if (!Number.isFinite(width)) return PANEL_MIN
  return Math.round(Math.max(PANEL_MIN, Math.min(PANEL_MAX, width)))
}

/** Width after dragging the inner edge by `dx` px (screen-space, left → right). */
export function dragPanelWidth(
  side: PanelSide,
  startWidth: number,
  dx: number,
): number {
  return clampPanelWidth(startWidth + (side === 'left' ? dx : -dx))
}

/** Width after an arrow key on the splitter; null for keys that do not resize. */
export function keyPanelWidth(
  side: PanelSide,
  width: number,
  key: string,
  shift: boolean,
): number | null {
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null
  const step = shift ? PANEL_STEP_LARGE : PANEL_STEP
  // The left panel grows rightward, the right panel leftward.
  const grows = (key === 'ArrowRight') === (side === 'left')
  return clampPanelWidth(width + (grows ? step : -step))
}

export function loadPanelWidth(side: PanelSide): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + side)
    const n = raw === null ? Number.NaN : Number(raw)
    return Number.isFinite(n) ? clampPanelWidth(n) : PANEL_DEFAULTS[side]
  } catch {
    return PANEL_DEFAULTS[side]
  }
}

export function savePanelWidth(side: PanelSide, width: number): void {
  try {
    window.localStorage.setItem(
      STORAGE_PREFIX + side,
      String(clampPanelWidth(width)),
    )
  } catch {
    // Storage unavailable (private mode / quota): size stays session-only.
  }
}
