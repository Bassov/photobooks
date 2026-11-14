/* The site root's size and the phone breakpoint (≤ 640), from the stand's site-demo-1/v2 (personal-site K1). */
import * as React from 'react'

export const reduced = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches

export type Box = { w: number; h: number; narrow: boolean }
/** the root's size and the phone flag; the kit body's min-width 1280 is lifted while the site is mounted */
export function useBox<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  Box,
] {
  const ref = React.useRef<T>(null)
  const [box, setBox] = React.useState({ w: innerWidth, h: innerHeight })
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    r()
    const ro = new ResizeObserver(r)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  React.useLayoutEffect(() => {
    const s = document.body.style,
      m = s.minWidth
    s.minWidth = '0'
    return () => {
      s.minWidth = m
    }
  }, [])
  return [ref, { ...box, narrow: box.w <= 640 }]
}
