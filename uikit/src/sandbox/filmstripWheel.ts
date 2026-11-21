/* Copy of prod src/editor/filmstripWheel.ts (the kit imports no prod code); keep the two in step.
 * Owner Must M50 / Designer M137: a vertical wheel over the filmstrip scrolls it sideways and never reaches
 * the page or the canvas zoom. Passive listener (a blocking wheel handler over the strip costs long frames);
 * a horizontal swipe keeps its native scroll; `overscroll-contain` on the strip stops the vertical chain. */

/** CSS px per wheel line (`deltaMode` 1, Firefox mouse wheels). */
const WHEEL_LINE_PX = 16

/** Horizontal scroll (px) for a vertical wheel: line mode scales by 16 px, page mode scrolls one viewport. */
function filmstripWheelDelta(event: Pick<WheelEvent, "deltaY" | "deltaMode">, viewportWidth: number): number {
  if (event.deltaMode === 1) return event.deltaY * WHEEL_LINE_PX
  if (event.deltaMode === 2) return event.deltaY * viewportWidth
  return event.deltaY
}

/** Kit difference: the listener sits on `node` and scrolls `strip()` — the RAC grid inside the kit dock mounts
 *  after its parent's first effect, so the strip is looked up per wheel event. */
export function installFilmstripWheel(node: HTMLElement | null, strip: () => HTMLElement | null = () => node): (() => void) | undefined {
  if (!node) return undefined
  const onWheel = (event: WheelEvent) => {
    const el = strip()
    if (el && Math.abs(event.deltaY) > Math.abs(event.deltaX)) el.scrollLeft += filmstripWheelDelta(event, el.clientWidth)
  }
  node.addEventListener("wheel", onWheel, { passive: true })
  return () => node.removeEventListener("wheel", onWheel)
}
