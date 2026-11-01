/** CSS px per wheel line (`deltaMode` 1, Firefox mouse wheels). */
export const WHEEL_LINE_PX = 16

/**
 * Horizontal scroll (px) for a vertical wheel over the filmstrip. Line mode
 * (`deltaMode` 1) scales by {@link WHEEL_LINE_PX}; page mode (2) scrolls one
 * viewport.
 */
export function filmstripWheelDelta(
  event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>,
  viewportWidth: number,
): number {
  const delta = event.deltaY
  if (event.deltaMode === 1) {
    return delta * WHEEL_LINE_PX
  }
  if (event.deltaMode === 2) {
    return delta * viewportWidth
  }
  return delta
}

/**
 * Owner Must M50 (round 7): a wheel over the filmstrip scrolls it sideways
 * and never reaches the page or the canvas camera. The listener is passive:
 * a blocking wheel handler over the strip costs long frames on every strip
 * scroll (1000-photo LoAF gate). A horizontal swipe keeps its native scroll;
 * `overscroll-behavior: contain` (Filmstrip.css) stops the vertical chain.
 */
export function installFilmstripWheel(
  node: HTMLElement | null,
): (() => void) | undefined {
  if (node === null) {
    return undefined
  }
  const onWheel = (event: WheelEvent): void => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      node.scrollLeft += filmstripWheelDelta(event, node.clientWidth)
    }
  }
  node.addEventListener('wheel', onWheel, { passive: true })
  return () => {
    node.removeEventListener('wheel', onWheel)
  }
}
