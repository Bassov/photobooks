import type { NormalizedRect } from '../core'

/** Marks the wrapper that carries rAF preview transforms for a turned photo. */
export const PHOTO_LAYER_ATTR = 'data-photo-layer'

export interface TurnedPhotoStyle {
  left: number
  top: number
  width: number
  height: number
  transform: string
}

const round = (value: number): number => Math.round(value * 1000) / 1000

/**
 * Box of a photo turned by quarter turns and a fine angle. `window` is the
 * frame's crop window in unturned source space. The image is laid out in
 * source orientation with its center on the frame center, shifted so the
 * window center sits there, then rotated about it.
 */
export function turnedPhotoStyle(
  framePx: { width: number; height: number },
  window: NormalizedRect,
  quarterTurns: number,
  straightenDeg: number,
  flip: { h?: boolean; v?: boolean } = {},
): TurnedPhotoStyle {
  const odd = quarterTurns % 2 === 1
  const width = (odd ? framePx.height : framePx.width) / window.width
  const height = (odd ? framePx.width : framePx.height) / window.height
  const shiftX = (0.5 - (window.x + window.width / 2)) * width
  const shiftY = (0.5 - (window.y + window.height / 2)) * height
  return {
    left: round(framePx.width / 2 - width / 2),
    top: round(framePx.height / 2 - height / 2),
    width: round(width),
    height: round(height),
    // Flip is innermost, as in the kit (uikit/src/sandbox/canvas.tsx:35).
    transform: `rotate(${String(round(quarterTurns * 90 + straightenDeg))}deg) translate(${String(round(shiftX))}px, ${String(round(shiftY))}px)${flip.h === true || flip.v === true ? ` scale(${flip.h === true ? '-1' : '1'}, ${flip.v === true ? '-1' : '1'})` : ''}`,
  }
}

/**
 * Direct-crop grabber point, % of the frame: the centre of the visible photo
 * (the photo box clipped to the frame); a turned photo uses the frame centre.
 */
export function grabberPoint(
  window: NormalizedRect,
  turned: boolean,
): { x: number; y: number } {
  if (turned) {
    return { x: 50, y: 50 }
  }
  const axis = (start: number, size: number): number => {
    const from = Math.max(0, (-100 * start) / size)
    const to = Math.min(100, (100 * (1 - start)) / size)
    return (from + to) / 2
  }
  return { x: axis(window.x, window.width), y: axis(window.y, window.height) }
}

/** Elements that take a preview transform: turned layers, else bare images. */
function photoPreviewTargets(root: Element): HTMLElement[] {
  const targets = new Set<HTMLElement>()
  for (const img of root.querySelectorAll('img')) {
    const layer = img.closest(`[${PHOTO_LAYER_ATTR}]`)
    targets.add(layer instanceof HTMLElement ? layer : img)
  }
  return [...targets]
}

/**
 * Paint a preview transform about the frame center on every photo of `frame`.
 * Bare images get a pixel origin; layers already span the frame.
 */
export function paintPhotoPreview(frame: HTMLElement, transform: string): void {
  for (const target of photoPreviewTargets(frame)) {
    if (target instanceof HTMLImageElement) {
      const ox = frame.offsetWidth / 2 - target.offsetLeft
      const oy = frame.offsetHeight / 2 - target.offsetTop
      target.style.transformOrigin = `${String(ox)}px ${String(oy)}px`
    }
    target.style.transform = transform
  }
}

export function clearPhotoPreview(frame: Element): void {
  for (const target of photoPreviewTargets(frame)) {
    target.style.transform = ''
    target.style.transformOrigin = ''
  }
}
