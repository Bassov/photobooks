import { useLayoutEffect, useState, type RefObject } from 'react'

export interface Viewport {
  vw: number
  vh: number
}

/**
 * Root width and window height (`height: 'element'`: the root's own height,
 * for a page embedded in a scroll box); null on the server and in the
 * hydrating render, so the first client render matches the prerendered markup.
 */
export function useViewport(
  ref: RefObject<HTMLElement | null>,
  { height = 'window' }: { height?: 'window' | 'element' } = {},
): Viewport | null {
  const [viewport, setViewport] = useState<Viewport | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el === null) return
    const measure = () => {
      const vw = el.clientWidth
      const vh =
        height === 'element'
          ? el.clientHeight
          : document.documentElement.clientHeight
      setViewport((prev) =>
        prev?.vw === vw && prev.vh === vh ? prev : { vw, vh },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [ref, height])
  return viewport
}
