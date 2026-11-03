import { useRef, useState, type RefObject } from 'react'

export interface ClientSize {
  width: number
  height: number
}

/**
 * Client size of the element the returned ref callback is attached to,
 * re-measured on every resize; `null` until attached. The callback is created
 * once, so React never detaches and re-attaches it between renders. The ref
 * holds the last attached element (e.g. the Masters rulers' scroll area).
 */
export function useClientSize(): [
  ClientSize | null,
  (node: HTMLDivElement) => () => void,
  RefObject<HTMLDivElement | null>,
] {
  const [size, setSize] = useState<ClientSize | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)
  const [attach] = useState(() => (node: HTMLDivElement) => {
    ref.current = node
    const measure = (): void => {
      setSize({ width: node.clientWidth, height: node.clientHeight })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  })
  return [size, attach, ref]
}
