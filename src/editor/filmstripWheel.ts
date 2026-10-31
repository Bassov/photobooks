/** CSS px per wheel line (`deltaMode` 1, Firefox mouse wheels). */
export const WHEEL_LINE_PX = 16

/**
 * Horizontal scroll (px) for a wheel over the filmstrip: the dominant axis,
 * so a vertical mouse wheel scrolls sideways and a trackpad swipe keeps its
 * own horizontal delta. Page mode (`deltaMode` 2) scrolls one viewport.
 */
export function filmstripWheelDelta(
  event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>,
  viewportWidth: number,
): number {
  const delta =
    Math.abs(event.deltaY) > Math.abs(event.deltaX)
      ? event.deltaY
      : event.deltaX
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
 * and never reaches the page or the canvas camera.
 */
export function installFilmstripWheel(
  node: HTMLElement | null,
): (() => void) | undefined {
  if (node === null) {
    return undefined
  }
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    node.scrollLeft += filmstripWheelDelta(event, node.clientWidth)
  }
  node.addEventListener('wheel', onWheel, { passive: false })
  return () => {
    node.removeEventListener('wheel', onWheel)
  }
}
