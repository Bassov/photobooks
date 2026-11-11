/* One scroll listener on the site's own scroller; chapters subscribe and read their progress in the same frame. */
import * as React from "react"

type Sub = () => void
export type ScrollCtx = { el: React.RefObject<HTMLDivElement | null>; sub: (f: Sub) => () => void }
export const Scroll = React.createContext<ScrollCtx | null>(null)

export function useScroller(el: React.RefObject<HTMLDivElement | null>): ScrollCtx {
  const subs = React.useRef(new Set<Sub>())
  React.useEffect(() => {
    const e = el.current; if (!e) return
    let raf = 0
    const tick = () => { raf = 0; for (const f of subs.current) f() }
    const on = () => { if (!raf) raf = requestAnimationFrame(tick) }
    e.addEventListener("scroll", on, { passive: true })
    window.addEventListener("resize", on)
    return () => { e.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf) }
  }, [el])
  return React.useMemo(() => ({ el, sub: (f: Sub) => { subs.current.add(f); f(); return () => { subs.current.delete(f) } } }), [el])
}

export function useOnScroll(f: Sub, deps: React.DependencyList) {
  const ctx = React.useContext(Scroll)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => ctx?.sub(f), [ctx, ...deps])
}

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches
export const smooth = (): ScrollBehavior => (reducedMotion() ? "auto" : "smooth")
